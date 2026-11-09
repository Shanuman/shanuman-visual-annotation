/* global shanumanVaConfig, wpVaConfig, wp, window, document */
( function ( wp ) {
	const { useState, useEffect, createElement: el } = wp.element;

	const cfg = typeof shanumanVaConfig !== 'undefined' 
		? shanumanVaConfig 
		: ( typeof wpVaConfig !== 'undefined' ? wpVaConfig : {} );

	const primaryColor   = cfg.buttonColor || '#2271b1';
	const accentColor    = cfg.accentColor || '#46b450';
	const reopenColor    = cfg.reopenColor || '#f56e28';
	const attentionColor = cfg.attentionColor || '#d63638';
	const currentUserId  = parseInt( cfg.currentUserId, 10 ) || 0;
	const isAdmin        = Boolean( cfg.isAdmin );
	const restBase       = ( cfg.restUrl || '/wp-json/' ).replace( /\/?$/, '/' );

	const AdminDashboard = () => {
		const [ pins, setPins ] = useState( [] );
		const [ loading, setLoading ] = useState( true );
		const [ expandedUrls, setExpandedUrls ] = useState( {} );
		const [ replyDrafts, setReplyDrafts ] = useState( {} );
		const [ editingReplyId, setEditingReplyId ] = useState( null );
		const [ editDraftText, setEditDraftText ] = useState( '' );

		// 1. Fetch Annotations
		const loadPins = ( showSpinner = false ) => {
			if ( showSpinner ) {
				setLoading( true );
			}
			const cacheBuster = new Date().getTime();
			fetch( `${ restBase }shanuman-va/v1/annotations?context=admin&show_resolved=true&t=${ cacheBuster }`, {
				headers: { 'X-WP-Nonce': cfg.nonce },
			} )
			.then( ( res ) => res.json() )
			.then( ( data ) => {
				const pinList = Array.isArray( data ) ? data : [];
				setPins( pinList );
				setLoading( false );

				// Automatically expand all URL groups by default on first load
				setExpandedUrls( ( prev ) => {
					if ( Object.keys( prev ).length > 0 ) return prev;
					const defaults = {};
					pinList.forEach( ( p ) => {
						const key = p.url || '/';
						defaults[ key ] = true;
					} );
					return defaults;
				} );
			} )
			.catch( ( err ) => {
				console.error( 'Error fetching annotations:', err );
				setLoading( false );
			} );
		};

		useEffect( () => {
			loadPins( true );

			const handleSync = () => {
				if ( document.visibilityState === 'visible' ) {
					loadPins( false );
				}
			};

			window.addEventListener( 'focus', handleSync );
			document.addEventListener( 'visibilitychange', handleSync );

			return () => {
				window.removeEventListener( 'focus', handleSync );
				document.removeEventListener( 'visibilitychange', handleSync );
			};
		}, [] );

		// 2. Action Handlers
		const toggleUrl = ( url ) => {
			setExpandedUrls( ( prev ) => ( { ...prev, [ url ]: ! prev[ url ] } ) );
		};

		const handleApprove = ( id ) => {
			fetch( `${ restBase }shanuman-va/v1/annotations/${ id }/approve`, {
				method: 'POST',
				headers: { 'X-WP-Nonce': cfg.nonce },
			} ).then( () => loadPins( false ) );
		};

		const handleReopen = ( id ) => {
			fetch( `${ restBase }shanuman-va/v1/annotations/${ id }/reopen`, {
				method: 'POST',
				headers: { 'X-WP-Nonce': cfg.nonce },
			} ).then( () => loadPins( false ) );
		};

		const handleToggleFlag = ( id ) => {
			fetch( `${ restBase }shanuman-va/v1/annotations/${ id }/flag`, {
				method: 'POST',
				headers: { 'X-WP-Nonce': cfg.nonce },
			} ).then( () => loadPins( false ) );
		};

		const handleDeletePin = ( id ) => {
			if ( ! window.confirm( `Are you sure you want to delete Pin #${ id } permanently?` ) ) {
				return;
			}
			fetch( `${ restBase }shanuman-va/v1/annotations/${ id }`, {
				method: 'DELETE',
				headers: { 'X-WP-Nonce': cfg.nonce },
			} ).then( () => loadPins( false ) );
		};

		const handleBulkDelete = ( urlKey ) => {
			const matchingPins = pins.filter( ( p ) => ( p.url || '/' ) === urlKey );
			if ( ! window.confirm( `Are you sure you want to delete all ${ matchingPins.length } pins for ${ urlKey }?` ) ) {
				return;
			}

			Promise.all(
				matchingPins.map( ( p ) =>
					fetch( `${ restBase }shanuman-va/v1/annotations/${ p.id }`, {
						method: 'DELETE',
						headers: { 'X-WP-Nonce': cfg.nonce },
					} )
				)
			).then( () => loadPins( false ) );
		};

		const handleAddReply = ( pinId ) => {
			const text = ( replyDrafts[ pinId ] || '' ).trim();
			if ( ! text ) return;

			fetch( `${ restBase }shanuman-va/v1/annotations/${ pinId }/replies`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': cfg.nonce,
				},
				body: JSON.stringify( { reply: text } ),
			} )
			.then( ( res ) => res.json() )
			.then( () => {
				setReplyDrafts( ( prev ) => ( { ...prev, [ pinId ]: '' } ) );
				loadPins( false );
			} );
		};

		const handleSaveReplyEdit = ( pinId, replyId ) => {
			const newText = editDraftText.trim();
			if ( ! newText ) return;

			fetch( `${ restBase }shanuman-va/v1/annotations/${ pinId }/replies/${ encodeURIComponent( replyId ) }`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': cfg.nonce,
				},
				body: JSON.stringify( { reply: newText } ),
			} )
			.then( ( res ) => res.json() )
			.then( () => {
				setEditingReplyId( null );
				setEditDraftText( '' );
				loadPins( false );
			} );
		};

		const handleDeleteReply = ( pinId, replyId ) => {
			if ( ! window.confirm( 'Are you sure you want to delete this reply?' ) ) {
				return;
			}
			fetch( `${ restBase }shanuman-va/v1/annotations/${ pinId }/replies/${ encodeURIComponent( replyId ) }`, {
				method: 'DELETE',
				headers: { 'X-WP-Nonce': cfg.nonce },
			} )
			.then( ( res ) => res.json() )
			.then( () => loadPins( false ) );
		};

		const handleMarkReplySeen = ( pinId, replyId ) => {
			fetch( `${ restBase }shanuman-va/v1/annotations/${ pinId }/replies/${ encodeURIComponent( replyId ) }/seen`, {
				method: 'POST',
				headers: { 'X-WP-Nonce': cfg.nonce },
			} ).catch( () => {} );
		};

		// 3. Group Pins by URL
		const grouped = pins.reduce( ( acc, pin ) => {
			const urlKey = pin.url || '/';
			if ( ! acc[ urlKey ] ) acc[ urlKey ] = [];
			acc[ urlKey ].push( pin );
			return acc;
		}, {} );

		if ( loading ) {
			return el(
				'div',
				{ style: { padding: '24px', background: '#fff', border: '1px solid #ccd0d4', borderRadius: '4px' } },
				el( 'p', { style: { margin: 0, fontSize: '14px', color: '#646970' } }, 'Loading feedback and annotations...' )
			);
		}

		if ( Object.keys( grouped ).length === 0 ) {
			return el(
				'div',
				{ style: { padding: '24px', background: '#fff', border: '1px solid #ccd0d4', borderRadius: '4px' } },
				el( 'p', { style: { margin: 0, fontSize: '14px', color: '#646970' } }, 'No annotations found. When comments are dropped on the frontend, they will appear here.' )
			);
		}

		return el(
			'div',
			{ className: 'shanuman-va-dashboard', style: { maxWidth: '980px', marginTop: '15px' } },
			Object.keys( grouped ).map( ( urlKey ) => {
				const urlPins = grouped[ urlKey ];
				const isExpanded = Boolean( expandedUrls[ urlKey ] );
				const displayTitle = urlKey === '/' ? 'Home Page (/)' : urlKey;

				return el(
					'div',
					{
						key: urlKey,
						style: {
							marginBottom: '20px',
							border: '1px solid #ccd0d4',
							background: '#fff',
							borderRadius: '6px',
							overflow: 'hidden',
							boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
						},
					},
					// URL Group Header
					el(
						'div',
						{
							style: {
								padding: '14px 18px',
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								background: '#f8f9fa',
								borderBottom: isExpanded ? '1px solid #ccd0d4' : 'none',
								cursor: 'pointer',
								userSelect: 'none',
							},
							onClick: () => toggleUrl( urlKey ),
						},
						el(
							'div',
							{ style: { display: 'flex', alignItems: 'center', gap: '8px' } },
							el( 'span', {
								className: 'dashicons dashicons-arrow-' + ( isExpanded ? 'up' : 'down' ),
								style: { color: '#646970', fontSize: '18px' },
							} ),
							el( 'strong', { style: { fontSize: '15px', color: '#1d2327' } }, `${ displayTitle }` ),
							el(
								'span',
								{
									style: {
										background: '#e0e0e0',
										borderRadius: '10px',
										padding: '2px 8px',
										fontSize: '11px',
										fontWeight: '600',
										color: '#50575e',
									},
								},
								`${ urlPins.length } ${ urlPins.length === 1 ? 'thread' : 'threads' }`
							)
						),
						el(
							'div',
							{ style: { display: 'flex', alignItems: 'center', gap: '12px' } },
							isAdmin &&
								el(
									'button',
									{
										type: 'button',
										className: 'button button-secondary',
										style: { color: '#d63638', borderColor: '#d63638', fontSize: '12px', padding: '0 10px', height: '28px' },
										onClick: ( e ) => {
											e.stopPropagation();
											handleBulkDelete( urlKey );
										},
									},
									'Bulk Delete'
								)
						)
					),
					// Group Threads Body
					isExpanded &&
						el(
							'div',
							{ style: { padding: '18px', display: 'flex', flexDirection: 'column', gap: '18px' } },
							urlPins.map( ( pin ) => {
								const isApproved = pin.status === 'approved';
								const isReopened = pin.status === 'reopened';
								const isAuthor = currentUserId > 0 && currentUserId === parseInt( pin.author_id, 10 );
								const canDeletePin = isAdmin || isAuthor;

								let borderColor = primaryColor;
								if ( isApproved ) borderColor = accentColor;
								else if ( isReopened ) borderColor = reopenColor;

								const flagColor = pin.flagged ? attentionColor : '#8c8f94';
								const flagFill  = pin.flagged ? attentionColor : 'none';

								return el(
									'div',
									{
										key: pin.id,
										style: {
											padding: '16px',
											background: '#fcfcfc',
											border: '1px solid #e2e4e7',
											borderLeft: `5px solid ${ borderColor }`,
											borderRadius: '4px',
										},
									},
									// Thread Card Top Header
									el(
										'div',
										{ style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } },
										el(
											'div',
											{ style: { fontSize: '13px', color: '#646970', display: 'flex', alignItems: 'center', gap: '6px' } },
											el( 'strong', { style: { color: '#1d2327' } }, `Pin #${ pin.id }` ),
											el( 'span', null, '\u2022' ),
											el( 'span', null, pin.author_name || 'Reviewer' ),
											el( 'span', null, '\u2022' ),
											el( 'span', null, pin.date ),
											el(
												'svg',
												{
													viewBox: '0 0 24 24',
													width: 14,
													height: 14,
													stroke: flagColor,
													strokeWidth: 2,
													fill: flagFill,
													strokeLinecap: 'round',
													strokeLinejoin: 'round',
													style: { cursor: 'pointer', marginLeft: '6px' },
													title: pin.flagged ? 'Priority Item (Flagged)' : 'Flag as Priority',
													onClick: () => handleToggleFlag( pin.id ),
												},
												el( 'path', { d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' } ),
												el( 'line', { x1: '4', y1: '22', x2: '4', y2: '15' } )
											)
										),
										// Action Links Row (View on Page, Approve/Reopen, Delete)
										el(
											'div',
											{ style: { display: 'flex', gap: '12px', alignItems: 'center' } },
											// Deep Link to Frontend Pin
											pin.url && ! isApproved && ! pin.orphaned &&
												el(
													'a',
													{
														className: 'button button-link',
														style: { color: primaryColor, textDecoration: 'none', padding: 0, fontWeight: 'bold', fontSize: '12px' },
														href: ( pin.url || '/' ) + ( ( pin.url || '/' ).includes( '?' ) ? '&' : '?' ) + 'shanuman_va_open_pin=' + pin.id,
														target: '_blank',
														rel: 'noopener noreferrer',
													},
													'View on Page'
												),
											! isApproved &&
												el(
													'button',
													{
														type: 'button',
														className: 'button button-link',
														style: { color: accentColor, textDecoration: 'none', padding: 0, fontWeight: 'bold', fontSize: '12px' },
														onClick: () => handleApprove( pin.id ),
													},
													'Approve'
												),
											isApproved &&
												el(
													'button',
													{
														type: 'button',
														className: 'button button-link',
														style: { color: reopenColor, textDecoration: 'none', padding: 0, fontWeight: 'bold', fontSize: '12px' },
														onClick: () => handleReopen( pin.id ),
													},
													'Reopen'
												),
											canDeletePin &&
												el(
													'button',
													{
														type: 'button',
														className: 'button button-link',
														style: { color: '#d63638', textDecoration: 'none', padding: 0, fontSize: '12px' },
														onClick: () => handleDeletePin( pin.id ),
													},
													'Delete'
												)
										)
									),
									// Main Comment Content
									el(
										'div',
										{ style: { fontSize: '14px', color: '#2c3338', lineHeight: 1.5, margin: '6px 0 10px 0' } },
										pin.comment
									),
									// Target Element XPath Info
									pin.xpath &&
										el(
											'div',
											{ style: { fontSize: '11px', color: '#8c8f94', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '12px' } },
											`XPath: ${ pin.xpath }`
										),
									// Threaded Replies
									pin.replies && pin.replies.length > 0 &&
										el(
											'div',
											{
												style: {
													marginLeft: '8px',
													paddingLeft: '12px',
													borderLeft: `2px solid ${ borderColor }`,
													marginTop: '10px',
													marginBottom: '12px',
													display: 'flex',
													flexDirection: 'column',
													gap: '10px',
												},
											},
											pin.replies.map( ( r ) => {
												const isReplyAuthor = currentUserId > 0 && currentUserId === parseInt( r.user_id, 10 );
												const canDeleteReply = isAdmin || isReplyAuthor;
												const isEditing = editingReplyId === r.id;
												const seenBy = Array.isArray( r.seen_by ) ? r.seen_by : [];
												const isUnread = ! isReplyAuthor && ! seenBy.includes( currentUserId );
												const showBadge = isUnread || r.is_edited;
												const badgeColor = isUnread ? attentionColor : '#a7aaad';

												return el(
													'div',
													{ key: r.id, style: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: '4px', padding: '10px 12px' } },
													el(
														'div',
														{ style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' } },
														el(
															'div',
															{ style: { fontSize: '12px', color: '#646970', display: 'flex', alignItems: 'center', gap: '6px' } },
															el( 'strong', { style: { color: '#1d2327' } }, r.author_name || 'Reviewer' ),
															el( 'span', null, '\u2022' ),
															el( 'span', null, r.date ),
															showBadge &&
																el(
																	'span',
																	{
																		title: r.is_edited ? `Original: ${ r.original_content }` : 'Unread Reply',
																		style: {
																			color: badgeColor,
																			fontWeight: isUnread ? 'bold' : 'normal',
																			cursor: 'help',
																			display: 'inline-flex',
																			alignItems: 'center',
																			gap: '4px',
																			marginLeft: '4px',
																		},
																		onMouseEnter: () => {
																			if ( isUnread ) handleMarkReplySeen( pin.id, r.id );
																		},
																	},
																	`\u2022 ${ isUnread && ! r.is_edited ? 'New' : 'Edited' }`,
																	el(
																		'span',
																		{
																			style: {
																				display: 'inline-flex',
																				justifyContent: 'center',
																				alignItems: 'center',
																				width: '13px',
																				height: '13px',
																				backgroundColor: badgeColor,
																				color: '#fff',
																				borderRadius: '50%',
																				fontSize: '9px',
																				fontWeight: 'bold',
																			},
																		},
																		isUnread && ! r.is_edited ? '!' : 'i'
																	)
																)
														),
														el(
															'div',
															{ style: { display: 'flex', gap: '8px', alignItems: 'center' } },
															isReplyAuthor && ! isEditing &&
																el(
																	'button',
																	{
																		type: 'button',
																		className: 'button button-link',
																		style: { color: primaryColor, textDecoration: 'none', padding: 0, fontSize: '11px' },
																		onClick: () => {
																			setEditingReplyId( r.id );
																			setEditDraftText( r.content );
																		},
																	},
																	'Edit'
																),
															canDeleteReply && ! isEditing &&
																el(
																	'button',
																	{
																		type: 'button',
																		className: 'button button-link',
																		style: { color: '#d63638', textDecoration: 'none', padding: 0, fontSize: '11px' },
																		onClick: () => handleDeleteReply( pin.id, r.id ),
																	},
																	'Delete'
																)
														)
													),
													isEditing
														? el(
																'div',
																{ style: { marginTop: '6px' } },
																el( 'textarea', {
																	rows: 2,
																	style: { width: '100%', boxSizing: 'border-box', padding: '6px', fontSize: '12px', border: `1px solid ${ primaryColor }`, borderRadius: '4px' },
																	value: editDraftText,
																	onChange: ( e ) => setEditDraftText( e.target.value ),
																} ),
																el(
																	'div',
																	{ style: { display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' } },
																	el(
																		'button',
																		{
																			type: 'button',
																			className: 'button button-secondary',
																			style: { fontSize: '11px', height: '26px', padding: '0 8px' },
																			onClick: () => {
																				setEditingReplyId( null );
																				setEditDraftText( '' );
																			},
																		},
																		'Cancel'
																	),
																	el(
																		'button',
																		{
																			type: 'button',
																			className: 'button button-primary',
																			style: { backgroundColor: primaryColor, borderColor: primaryColor, fontSize: '11px', height: '26px', padding: '0 8px' },
																			onClick: () => handleSaveReplyEdit( pin.id, r.id ),
																		},
																		'Save'
																	)
																)
														  )
														: el(
																'div',
																{ style: { fontSize: '13px', color: '#2c3338', marginTop: '4px', lineHeight: 1.4 } },
																r.content
														  )
												);
											} )
										),
									// Add Reply Input Row
									el(
										'div',
										{ style: { display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '10px' } },
										el( 'textarea', {
											placeholder: 'Write a reply...',
											rows: 2,
											value: replyDrafts[ pin.id ] || '',
											onChange: ( e ) => {
												const val = e.target.value;
												setReplyDrafts( ( prev ) => ( { ...prev, [ pin.id ]: val } ) );
											},
											style: { flex: 1, padding: '8px', border: '1px solid #8c8f94', borderRadius: '4px', fontSize: '13px' },
										} ),
										el(
											'button',
											{
												type: 'button',
												className: 'button button-primary',
												style: { backgroundColor: primaryColor, borderColor: primaryColor, height: '36px', padding: '0 16px', fontWeight: '600' },
												onClick: () => handleAddReply( pin.id ),
											},
											'Reply'
										)
									)
								);
							} )
						)
				);
			} )
		);
	};

	// Mount container safely once DOM is ready
	const mountTarget = document.getElementById( 'shanuman-va-admin-app' ) || document.getElementById( 'wp-va-admin-app' );
	if ( mountTarget ) {
		wp.element.render( el( AdminDashboard ), mountTarget );
	}
} )( window.wp );