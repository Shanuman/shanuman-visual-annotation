/* global shanumanVaConfig, wp, window, document */
( function( wp ) {
	const { useState, useEffect, useCallback } = wp.element;

	// Inject responsive styles and fade animations for administrative management
	const adminStyle = document.createElement('style');
	adminStyle.innerHTML = `
		.wp-va-thread-item {
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			transform-origin: top;
			opacity: 1;
			transform: scaleY(1);
			max-height: 300px;
			overflow: hidden;
			margin-bottom: 20px;
		}
		.wp-va-thread-item.fade-out {
			opacity: 0;
			transform: scaleY(0);
			max-height: 0;
			padding-top: 0;
			padding-bottom: 0;
			margin-bottom: 0;
			border: none;
		}
		@media(max-width: 782px) {
			.wp-va-stats-container { flex-direction: column !important; gap: 15px !important; }
			.wp-va-stats-container > div { border-left: none !important; padding-left: 0 !important; border-bottom: 1px solid #ccd0d4; padding-bottom: 15px; }
			.wp-va-stats-container > div:last-child { border-bottom: none; padding-bottom: 0; }
			.wp-va-controls-container { flex-direction: column; align-items: stretch !important; gap: 15px; }
			.wp-va-controls-container > div { justify-content: flex-start !important; flex-wrap: wrap; }
			.wp-va-pin-header { flex-direction: column; align-items: flex-start !important; gap: 10px; }
			.wp-va-pin-actions { width: 100%; justify-content: flex-start !important; flex-wrap: wrap; }
			.wp-va-reply-header { flex-direction: column; align-items: flex-start !important; gap: 8px; }
		}
	`;
	document.head.appendChild(adminStyle);

	// Reusable Flag Icon Component for flagging important feedback items
	const FlagIcon = ( { isFlagged, onClick } ) => {
		const alertColor = shanumanVaConfig.attentionColor || '#d63638';
		const color = isFlagged ? alertColor : '#8c8f94';
		const fill = isFlagged ? alertColor : 'none';
		return wp.element.createElement( 'svg', {
			viewBox: '0 0 24 24', width: '16', height: '16', stroke: color, strokeWidth: '2', fill: fill,
			strokeLinecap: 'round', strokeLinejoin: 'round',
			style: { cursor: 'pointer', verticalAlign: 'middle', marginLeft: '8px', transition: 'all 0.2s ease' },
			onClick: onClick
		}, 
			wp.element.createElement('path', { d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' }),
			wp.element.createElement('line', { x1: '4', y1: '22', x2: '4', y2: '15' })
		);
	};

	// Helper to format raw URLs into readable page titles for grouping
	const formatGroupTitle = ( url, pageTitle ) => {
		if ( pageTitle && pageTitle.trim() !== '' ) return pageTitle;
		if ( !url || url === '/' ) return 'Home Page';
		const cleanUrl = url.replace(/^\/|\/$/g, '');
		return cleanUrl.split(/[/-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
	};

	// Main Admin Dashboard Component
	const AdminDashboard = () => {
		const [ pins, setPins ] = useState( [] );
		const [ loading, setLoading ] = useState( true );
		const [ expandedUrls, setExpandedUrls ] = useState( {} );
		const [ replyText, setReplyText ] = useState( {} );
		const [ editingReplyId, setEditingReplyId ] = useState( null );
		const [ editReplyText, setEditReplyText ] = useState( '' );
		const [ activeTab, setActiveTab ] = useState( 'pending' );
		const [ submittingReply, setSubmittingReply ] = useState( {} ); 
		const [ fadingOutId, setFadingOutId ] = useState( null );

		const alertColor = shanumanVaConfig.attentionColor || '#d63638';

		// Fetch all annotation threads from the REST API
		const loadPins = useCallback( () => {
			fetch( `${ shanumanVaConfig.restUrl }shanuman-va/v1/annotations?context=admin&show_resolved=true`, { headers: { 'X-WP-Nonce': shanumanVaConfig.nonce } } )
			.then( res => res.json() ).then( data => { setPins( Array.isArray( data ) ? data : [] ); setLoading( false ); } )
			.catch( err => { console.error( 'Error fetching annotations:', err ); setLoading( false ); } );
		}, [] );

		useEffect( () => {
			loadPins();
			const handleFocus = () => loadPins();
			const handleVisibility = () => { if ( document.visibilityState === 'visible' ) loadPins(); };
			window.addEventListener( 'focus', handleFocus );
			document.addEventListener( 'visibilitychange', handleVisibility );
			return () => { window.removeEventListener( 'focus', handleFocus ); document.removeEventListener( 'visibilitychange', handleVisibility ); };
		}, [ loadPins ] );

		const toggleUrl = ( url ) => setExpandedUrls( prev => ( { ...prev, [url]: !prev[url] } ) );
		const handleExpandAll = () => { const all = {}; Object.keys( grouped ).forEach( url => { all[url] = true; } ); setExpandedUrls( all ); };
		const handleCollapseAll = () => setExpandedUrls( {} );

		// Handle approval, reopening, and deletion actions
		const handleAction = ( id, action ) => {
			if ( action === 'DELETE' && ! window.confirm( 'Delete this thread permanently?' ) ) return;
			
			if ( action === 'approve' || action === 'reopen' ) {
				setFadingOutId( id );
				setTimeout( () => {
					fetch( `${ shanumanVaConfig.restUrl }shanuman-va/v1/annotations/${ id }/${ action }`, {
						method: 'POST', headers: { 'X-WP-Nonce': shanumanVaConfig.nonce }
					} ).then( () => {
						setFadingOutId( null );
						loadPins();
					} );
				}, 300 );
				return;
			}

			fetch( `${ shanumanVaConfig.restUrl }shanuman-va/v1/annotations/${ id }${ action !== 'DELETE' ? '/' + action : '' }`, {
				method: action === 'DELETE' ? 'DELETE' : 'POST', headers: { 'X-WP-Nonce': shanumanVaConfig.nonce }
			} ).then( () => loadPins() );
		};

		const handleToggleFlag = ( id ) => {
			setPins( prev => prev.map( p => p.id === id ? { ...p, flagged: !p.flagged } : p ) );
			fetch( `${ shanumanVaConfig.restUrl }shanuman-va/v1/annotations/${ id }/flag`, { method: 'POST', headers: { 'X-WP-Nonce': shanumanVaConfig.nonce } } )
			.catch( () => loadPins() ); 
		};

		const handleBulkDelete = ( url ) => {
			if ( ! window.confirm( `Are you sure you want to delete ALL ${ activeTab === 'pending' ? 'pending' : 'approved' } threads for ${ url }?` ) ) return;
			const urlPins = filteredPins.filter( p => p.url === url );
			Promise.all( urlPins.map( p => fetch( `${ shanumanVaConfig.restUrl }shanuman-va/v1/annotations/${ p.id }`, { method: 'DELETE', headers: { 'X-WP-Nonce': shanumanVaConfig.nonce } } ) ) ).then( () => loadPins() );
		};

		const handleReply = ( id ) => {
			const text = replyText[id] || ''; if ( ! text.trim() ) return;
			setSubmittingReply( prev => ({ ...prev, [id]: true }) ); 
			fetch( `${ shanumanVaConfig.restUrl }shanuman-va/v1/annotations/${ id }/replies`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': shanumanVaConfig.nonce }, body: JSON.stringify( { reply: text } ) } )
			.then( () => { setReplyText( prev => ( { ...prev, [id]: '' } ) ); setSubmittingReply( prev => ({ ...prev, [id]: false }) ); loadPins(); } )
			.catch( () => { setSubmittingReply( prev => ({ ...prev, [id]: false }) ); });
		};

		const handleSaveEdit = ( pinId, replyId ) => {
			if ( ! editReplyText.trim() ) return;
			fetch( `${ shanumanVaConfig.restUrl }shanuman-va/v1/annotations/${ pinId }/replies/${ replyId }`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': shanumanVaConfig.nonce }, body: JSON.stringify( { reply: editReplyText } ) } )
			.then( res => res.json() ).then( data => { if ( data.replies ) { setEditingReplyId( null ); loadPins(); } } );
		};

		const handleDeleteReply = ( pinId, replyId ) => {
			if ( ! window.confirm( 'Are you sure you want to delete this reply?' ) ) return;
			fetch( `${ shanumanVaConfig.restUrl }shanuman-va/v1/annotations/${ pinId }/replies/${ replyId }`, { method: 'DELETE', headers: { 'X-WP-Nonce': shanumanVaConfig.nonce } } )
			.then( res => res.json() ).then( data => { if ( data.replies ) { loadPins(); } } );
		};

		const handleBadgeHover = ( pinId, replyId, isUnread ) => {
			if ( ! isUnread ) return;
			const currentUserId = parseInt( shanumanVaConfig.currentUserId, 10 );
			setPins( prev => prev.map( p => p.id === pinId ? { ...p, replies: p.replies.map( r => r.id === replyId ? { ...r, seen_by: [ ...( r.seen_by || [] ), currentUserId ] } : r ) } : p ) );
			fetch( `${ shanumanVaConfig.restUrl }shanuman-va/v1/annotations/${ pinId }/replies/${ replyId }/seen`, { method: 'POST', headers: { 'X-WP-Nonce': shanumanVaConfig.nonce } } ).catch( () => {} );
		};

		const totalPending = pins.filter( p => p.status !== 'approved' ).length;
		const totalResolved = pins.filter( p => p.status === 'approved' ).length;
		
		let totalUnread = 0;
		pins.forEach( p => { ( p.replies || [] ).forEach( r => {
			const currentUserId = parseInt( shanumanVaConfig.currentUserId, 10 );
			if ( parseInt( r.user_id, 10 ) !== currentUserId && !( r.seen_by || [] ).includes( currentUserId ) ) totalUnread++;
		} ); } );

		const filteredPins = pins.filter( pin => activeTab === 'pending' ? pin.status !== 'approved' : pin.status === 'approved' );
		const grouped = filteredPins.reduce( ( acc, pin ) => { const url = pin.url || 'Global / Unknown'; if ( ! acc[url] ) acc[url] = []; acc[url].push( pin ); return acc; }, {} );

		if ( loading ) return wp.element.createElement( 'div', { style: { padding: '20px' } }, wp.element.createElement( 'p', null, 'Loading feedback...' ) );

		return wp.element.createElement( 'div', { className: 'wp-va-dashboard', style: { maxWidth: '900px', marginTop: '20px' } }, 
			wp.element.createElement( 'div', { className: 'wp-va-stats-container', style: { display: 'flex', gap: '25px', background: '#fff', padding: '20px', border: '1px solid #ccd0d4', borderRadius: '4px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' } },
				wp.element.createElement( 'div', null, wp.element.createElement( 'strong', { style: { color: totalUnread > 0 ? alertColor : '#1d2327', fontSize: '20px', display: 'block' } }, totalUnread ), wp.element.createElement( 'span', { style: { fontSize: '13px', color: '#646970' } }, 'Unread Replies' ) ),
				wp.element.createElement( 'div', { style: { borderLeft: '1px solid #ccd0d4', paddingLeft: '25px' } }, wp.element.createElement( 'strong', { style: { fontSize: '20px', display: 'block', color: '#1d2327' } }, totalPending ), wp.element.createElement( 'span', { style: { fontSize: '13px', color: '#646970' } }, 'Pending Pins' ) ),
				wp.element.createElement( 'div', { style: { borderLeft: '1px solid #ccd0d4', paddingLeft: '25px' } }, wp.element.createElement( 'strong', { style: { fontSize: '20px', display: 'block', color: '#1d2327' } }, totalResolved ), wp.element.createElement( 'span', { style: { fontSize: '13px', color: '#646970' } }, 'Approved' ) )
			),
			wp.element.createElement( 'div', { className: 'wp-va-controls-container', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' } },
				wp.element.createElement( 'div', { style: { display: 'flex', gap: '10px' } },
					wp.element.createElement( 'button', { className: `button ${ activeTab === 'pending' ? 'button-primary' : '' }`, style: activeTab === 'pending' ? { backgroundColor: shanumanVaConfig.buttonColor, borderColor: shanumanVaConfig.buttonColor } : {}, onClick: () => setActiveTab( 'pending' ) }, 'Pending Feedback' ),
					wp.element.createElement( 'button', { className: `button ${ activeTab === 'resolved' ? 'button-primary' : '' }`, style: activeTab === 'resolved' ? { backgroundColor: shanumanVaConfig.buttonColor, borderColor: shanumanVaConfig.buttonColor } : {}, onClick: () => setActiveTab( 'resolved' ) }, 'Approved' )
				),
				Object.keys( grouped ).length > 0 && wp.element.createElement( 'div', { style: { display: 'flex', gap: '10px' } }, wp.element.createElement( 'button', { className: 'button', onClick: handleExpandAll }, 'Expand All' ), wp.element.createElement( 'button', { className: 'button', onClick: handleCollapseAll }, 'Collapse All' ) )
			),
			Object.keys( grouped ).length === 0 ? wp.element.createElement( 'div', { style: { padding: '20px', background: '#fff', border: '1px solid #ccd0d4', borderRadius: '4px' } }, wp.element.createElement( 'p', null, `No ${ activeTab === 'pending' ? 'pending' : 'approved' } annotations found.` ) ) : 
			Object.keys( grouped ).map( url => {
				const urlPins = grouped[url];
				const isExpanded = expandedUrls[url];
				const groupHasUnread = urlPins.some( p => ( p.replies || [] ).some( r => parseInt( r.user_id, 10 ) !== parseInt( shanumanVaConfig.currentUserId, 10 ) && !( r.seen_by || [] ).includes( parseInt( shanumanVaConfig.currentUserId, 10 ) ) ) );
				const groupHasFlag = urlPins.some( p => p.flagged );
				const groupTitle = formatGroupTitle( url, urlPins[0]?.page_title ); 

				return wp.element.createElement( 'div', { key: url, style: { marginBottom: '20px', border: '1px solid #ccd0d4', background: '#fff', borderRadius: '4px', overflow: 'hidden' } },
					wp.element.createElement( 'div', { style: { padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9f9', borderBottom: isExpanded ? '1px solid #ccd0d4' : 'none', cursor: 'pointer' }, onClick: () => toggleUrl( url ) },
						wp.element.createElement( 'div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, 
							wp.element.createElement( 'strong', { style: { fontSize: '16px', color: '#1d2327' }, title: url }, `${ groupTitle } (${ urlPins.length } pins)` ),
							groupHasUnread && !isExpanded && wp.element.createElement( 'div', { style: { width: '8px', height: '8px', backgroundColor: alertColor, borderRadius: '50%' } } ),
							groupHasFlag && wp.element.createElement( FlagIcon, { isFlagged: true } ) 
						),
						wp.element.createElement( 'div', { style: { display: 'flex', alignItems: 'center', gap: '15px' } },
							shanumanVaConfig.isAdmin && wp.element.createElement( 'button', { className: 'button', style: { color: '#d63638', borderColor: '#d63638' }, onClick: ( e ) => { e.stopPropagation(); handleBulkDelete( url ); } }, 'Bulk Delete Group' ),
							wp.element.createElement( 'span', { className: 'dashicons dashicons-arrow-' + ( isExpanded ? 'up' : 'down' ), style: { color: '#8c8f94' } } )
						)
					),
					isExpanded && wp.element.createElement( 'div', { style: { padding: '15px', display: 'flex', flexDirection: 'column', gap: '20px' } },
						urlPins.map( pin => {
							const canDelete = shanumanVaConfig.isAdmin || parseInt( pin.author_id, 10 ) === parseInt( shanumanVaConfig.currentUserId, 10 );
							const isApproved = pin.status === 'approved';
							const threadBorderColor = isApproved ? shanumanVaConfig.accentColor : shanumanVaConfig.buttonColor;
							const isPosting = submittingReply[pin.id] || false;
							const isFading = fadingOutId === pin.id;
							
							return wp.element.createElement( 'div', { key: pin.id, className: `wp-va-thread-item ${ isFading ? 'fade-out' : '' }`, style: { padding: '15px', borderLeft: `4px solid ${ threadBorderColor }`, background: '#f6f7f7', borderRadius: '0 4px 4px 0' } },
								wp.element.createElement( 'div', { className: 'wp-va-pin-header', style: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' } },
									wp.element.createElement( 'div', { style: { fontSize: '13px', color: '#646970', display: 'flex', alignItems: 'center' } }, 
										wp.element.createElement( 'strong', { style: { color: '#1d2327' } }, `Pin #${ pin.id }` ),
										` \u2022 ${ pin.author_name } \u2022 ${ pin.date }`,
										wp.element.createElement( FlagIcon, { isFlagged: pin.flagged, onClick: () => handleToggleFlag( pin.id ) } )
									),
									wp.element.createElement( 'div', { className: 'wp-va-pin-actions', style: { display: 'flex', gap: '10px' } },
										( ! isApproved ) && wp.element.createElement( 'a', { href: `${ pin.url }?wp_va_open_pin=${ pin.id }`, target: '_self', className: 'button button-link', style: { color: shanumanVaConfig.buttonColor, textDecoration: 'none', padding: 0, fontWeight: 'bold' } }, 'View' ),
										! isApproved && wp.element.createElement( 'button', { className: 'button button-link', style: { color: shanumanVaConfig.accentColor, textDecoration: 'none', padding: 0, fontWeight: 'bold' }, onClick: () => handleAction( pin.id, 'approve' ) }, 'Approve' ),
										isApproved && wp.element.createElement( 'button', { className: 'button button-link', style: { color: shanumanVaConfig.reopenColor, textDecoration: 'none', padding: 0, fontWeight: 'bold' }, onClick: () => handleAction( pin.id, 'reopen' ) }, 'Reopen' ),
										canDelete && wp.element.createElement( 'button', { className: 'button button-link', style: { color: '#d63638', textDecoration: 'none', padding: 0 }, onClick: () => handleAction( pin.id, 'DELETE' ) }, 'Delete' )
									)
								),
								wp.element.createElement( 'p', { style: { fontSize: '14px', marginTop: 0, color: '#2c3338' } }, pin.comment ),
								pin.replies && pin.replies.length > 0 && wp.element.createElement( 'div', { style: { marginLeft: '10px', paddingLeft: '15px', borderLeft: `2px solid ${ threadBorderColor }`, marginTop: '15px' } },
									pin.replies.map( r => {
										const currentUserId = parseInt( shanumanVaConfig.currentUserId, 10 );
										const isReplyAuthor = parseInt( r.user_id, 10 ) === currentUserId;
										const canDeleteReply = isReplyAuthor || shanumanVaConfig.isAdmin;
										const isEditing = editingReplyId === r.id;
										const isUnread = !isReplyAuthor && !( r.seen_by || [] ).includes( currentUserId );
										const showBadge = isUnread || r.is_edited;
										const badgeColor = isUnread ? alertColor : '#a7aaad';

										return wp.element.createElement( 'div', { key: r.id, style: { marginBottom: '12px' } },
											wp.element.createElement( 'div', { className: 'wp-va-reply-header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' } },
												wp.element.createElement( 'div', { style: { fontSize: '12px', color: '#646970', display: 'flex', alignItems: 'center', flexWrap: 'wrap' } }, 
													wp.element.createElement( 'strong', null, r.author_name ), wp.element.createElement( 'span', null, ` \u2022 ${ r.date }` ),
													showBadge && wp.element.createElement( 'span', { 
														title: r.is_edited ? `Original: ${ r.original_content }` : 'Mark as read',
														onMouseEnter: () => handleBadgeHover( pin.id, r.id, isUnread ),
														style: { color: badgeColor, marginLeft: '6px', cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: isUnread ? 'bold' : 'normal', transition: 'color 0.3s ease' }
													}, `\u2022 ${ isUnread && !r.is_edited ? 'New' : 'Edited' }`, wp.element.createElement( 'span', { style: { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '14px', height: '14px', background: badgeColor, color: '#fff', borderRadius: '50%', fontSize: '10px', fontWeight: 'bold', fontStyle: 'normal' } }, isUnread && !r.is_edited ? '!' : 'i' ) )
												),
												!isEditing && wp.element.createElement( 'div', { style: { display: 'flex', gap: '8px' } },
													isReplyAuthor && wp.element.createElement( 'button', { className: 'button button-link', style: { color: shanumanVaConfig.buttonColor, padding: 0, fontSize: '11px', textDecoration: 'none' }, onClick: () => { setEditingReplyId( r.id ); setEditReplyText( r.content ); } }, 'Edit' ),
													canDeleteReply && wp.element.createElement( 'button', { className: 'button button-link', style: { color: '#d63638', padding: 0, fontSize: '11px', textDecoration: 'none' }, onClick: () => handleDeleteReply( pin.id, r.id ) }, 'Delete' )
												)
											),
											isEditing ? wp.element.createElement( 'div', { style: { marginTop: '4px' } }, wp.element.createElement( 'textarea', { value: editReplyText, onChange: ( e ) => setEditReplyText( e.target.value ), rows: 2, style: { width: '100%', padding: '8px', border: `1px solid ${ shanumanVaConfig.buttonColor }`, borderRadius: '4px', fontSize: '13px' } } ), wp.element.createElement( 'div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' } }, wp.element.createElement( 'button', { className: 'button', onClick: () => { setEditingReplyId( null ); setEditReplyText( '' ); } }, 'Cancel' ), wp.element.createElement( 'button', { className: 'button button-primary', style: { backgroundColor: shanumanVaConfig.buttonColor, borderColor: shanumanVaConfig.buttonColor }, onClick: () => handleSaveEdit( pin.id, r.id ) }, 'Save' ) ) ) : wp.element.createElement( 'div', { style: { fontSize: '13px', color: '#2c3338', fontWeight: isUnread ? 'bold' : 'normal' } }, r.content )
										);
									} )
								),
								wp.element.createElement( 'div', { style: { marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'flex-start' } },
									wp.element.createElement( 'textarea', { value: replyText[pin.id] || '', onChange: ( e ) => setReplyText( { ...replyText, [pin.id]: e.target.value } ), placeholder: 'Write a reply...', rows: 2, style: { flex: 1, padding: '8px', border: '1px solid #8c8f94', borderRadius: '4px', fontSize: '13px' } } ),
									wp.element.createElement( 'button', { disabled: isPosting, className: 'button button-primary', style: { backgroundColor: shanumanVaConfig.buttonColor, borderColor: shanumanVaConfig.buttonColor, opacity: isPosting ? 0.6 : 1 }, onClick: () => handleReply( pin.id ) }, isPosting ? 'Posting...' : 'Reply' )
								)
							);
						} )
					)
				);
			} )
		);
	};

	// Attach strictly to the renamed frontend wrapper ID
	const rootNode = document.getElementById( 'shanuman-va-admin-app' );
	if ( rootNode ) wp.element.render( wp.element.createElement( AdminDashboard ), rootNode );

} )( wp );