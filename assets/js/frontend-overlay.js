/* global shanumanVaConfig */
( function () {
	const cfg             = typeof shanumanVaConfig !== 'undefined' ? shanumanVaConfig : {};
	const primaryColor    = cfg.buttonColor || '#2271b1';
	const accentColor     = cfg.accentColor || '#46b450';
	const reopenColor     = cfg.reopenColor || '#f56e28';
	const attentionColor  = cfg.attentionColor || '#d63638';
	const dimColor        = cfg.dimColor || '#000000';
	const dimOpacity      = ( cfg.dimOpacity !== undefined && cfg.dimOpacity !== '' ) ? parseFloat( cfg.dimOpacity ) : 0.7;
	const configuredWidth = parseInt( cfg.formWidth, 10 ) || 340;

	// Dynamic Typography Engine
	const baseFontSizeNum  = parseInt( cfg.baseFontSize, 10 ) || 11;
	const smallFontSizeNum = Math.max( 11, baseFontSizeNum - 2 );
	const baseFontSize     = `${ baseFontSizeNum }px`;
	const smallFontSize    = `${ smallFontSizeNum }px`;

	const activePins = [];
	let isAnnotating = false;
	let highlightBox = null;
	let isShowResolved = false;
	let isOverlayVisible = true;
	let isDimBackgroundActive = false;
	let dimBackdropNode = null;
	let isMutating = false;

	const responsiveStyle = document.createElement( 'style' );
	responsiveStyle.innerHTML = `
		#shanuman-va-bottom-left-toolbar, #shanuman-va-bottom-right-toolbar { pointer-events: none !important; flex-wrap: wrap !important; }
		#shanuman-va-bottom-left-toolbar > *, #shanuman-va-bottom-right-toolbar > * { pointer-events: auto !important; }
		#shanuman-va-bottom-left-toolbar { bottom: 20px !important; left: 20px !important; }
		#shanuman-va-bottom-right-toolbar { bottom: 20px !important; right: 20px !important; }
		@media (max-width: 768px) {
			#shanuman-va-bottom-left-toolbar { bottom: 15px !important; left: 10px !important; right: 10px !important; justify-content: center !important; }
			#shanuman-va-bottom-right-toolbar { bottom: 85px !important; left: 10px !important; right: 10px !important; justify-content: center !important; }
			#shanuman-va-bottom-left-toolbar button, #shanuman-va-bottom-right-toolbar button { font-size: 12px !important; padding: 8px 14px !important; border-radius: 16px !important; white-space: nowrap !important; margin: 0 !important; }
		}
	`;
	document.head.appendChild( responsiveStyle );

	const hexToRgb = ( hex ) => {
		let c;
		if ( /^#([A-Fa-f0-9]{3}){1,2}$/.test( hex ) ) {
			c = hex.substring( 1 ).split( '' );
			if ( c.length === 3 ) {
				c = [ c[0], c[0], c[1], c[1], c[2], c[2] ];
			}
			c = '0x' + c.join( '' );
			return [ ( c >> 16 ) & 255, ( c >> 8 ) & 255, c & 255 ].join( ',' );
		}
		return '0, 0, 0';
	};

	const escapeHtml = ( str ) => {
		if ( str === null || str === undefined ) {
			return '';
		}
		return String( str )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
	};

	const cursorStyle = document.createElement( 'style' );
	cursorStyle.innerHTML = 'body.shanuman-va-is-annotating * { cursor: crosshair !important; }';
	document.head.appendChild( cursorStyle );

	function showHighlight( element ) {
		if ( ! element ) {
			return;
		}
		if ( ! highlightBox ) {
			highlightBox = document.createElement( 'div' );
			highlightBox.id = 'shanuman-va-target-highlight';
			highlightBox.style.position = 'absolute';
			highlightBox.style.boxSizing = 'border-box';
			highlightBox.style.border = `2px solid ${ attentionColor }`;
			highlightBox.style.backgroundColor = `rgba(${ hexToRgb( attentionColor ) }, 0.08)`;
			highlightBox.style.pointerEvents = 'none';
			highlightBox.style.zIndex = '999997';
			highlightBox.style.transition = 'all 0.2s ease-in-out';
			document.body.appendChild( highlightBox );
		} else {
			highlightBox.style.border = `2px solid ${ attentionColor }`;
			highlightBox.style.backgroundColor = `rgba(${ hexToRgb( attentionColor ) }, 0.08)`;
		}
		const rect = element.getBoundingClientRect();
		highlightBox.style.left = `${ rect.left + window.scrollX }px`;
		highlightBox.style.top = `${ rect.top + window.scrollY }px`;
		highlightBox.style.width = `${ rect.width }px`;
		highlightBox.style.height = `${ rect.height }px`;
		highlightBox.style.display = 'block';
	}

	function hideHighlight() {
		if ( highlightBox ) {
			highlightBox.style.display = 'none';
		}
	}

	function toggleDimBackdrop( activate ) {
		isDimBackgroundActive = activate;
		if ( activate ) {
			if ( ! dimBackdropNode ) {
				dimBackdropNode = document.createElement( 'div' );
				dimBackdropNode.id = 'shanuman-va-dim-backdrop';
				dimBackdropNode.style.position = 'fixed';
				dimBackdropNode.style.top = '0';
				dimBackdropNode.style.left = '0';
				dimBackdropNode.style.width = '100vw';
				dimBackdropNode.style.height = '100vh';
				dimBackdropNode.style.backgroundColor = `rgba(${ hexToRgb( dimColor ) }, ${ dimOpacity })`;
				dimBackdropNode.style.zIndex = '999990';
				dimBackdropNode.style.pointerEvents = 'auto';

				dimBackdropNode.addEventListener( 'click', () => {
					document.querySelectorAll( '.shanuman-va-pin-form' ).forEach( ( f ) => {
						f.style.display = 'none';
					} );
					hideHighlight();
					toggleDimBackdrop( false );
					const dimBtn = document.getElementById( 'shanuman-va-dim-btn' );
					if ( dimBtn ) {
						dimBtn.textContent = 'Dim Background';
						dimBtn.style.backgroundColor = '#1d2327';
					}
				} );
				document.body.appendChild( dimBackdropNode );
			} else {
				dimBackdropNode.style.backgroundColor = `rgba(${ hexToRgb( dimColor ) }, ${ dimOpacity })`;
			}
			dimBackdropNode.style.display = 'block';
		} else if ( dimBackdropNode ) {
			dimBackdropNode.style.display = 'none';
		}
	}

	function getXPath( element ) {
		if ( ! element || element.nodeType !== 1 ) {
			return '';
		}
		if ( element.id && ! element.id.startsWith( 'shanuman-va-' ) ) {
			return `//*[@id="${ element.id }"]`;
		}
		const parts = [];
		let current = element;
		while ( current && current.nodeType === 1 ) {
			const tagName = current.nodeName.toLowerCase();
			if ( tagName === 'body' ) {
				parts.unshift( '//body' );
				break;
			}
			if ( current.id && ! current.id.startsWith( 'shanuman-va-' ) ) {
				parts.unshift( `//*[@id="${ current.id }"]` );
				break;
			}
			if ( [ 'footer', 'header', 'main' ].includes( tagName ) ) {
				if ( document.getElementsByTagName( tagName ).length === 1 ) {
					parts.unshift( `//${ tagName }` );
					break;
				}
			}
			let index = 1;
			let sibling = current.previousElementSibling;
			while ( sibling ) {
				if (
					sibling.nodeName.toLowerCase() === tagName &&
					! sibling.id.startsWith( 'shanuman-va-' ) &&
					! sibling.classList.contains( 'shanuman-va-pin' )
				) {
					index++;
				}
				sibling = sibling.previousElementSibling;
			}
			parts.unshift( `${ tagName }[${ index }]` );
			current = current.parentElement;
		}
		return parts.join( '/' );
	}

	function updateFormPosition( form, absoluteX, absoluteY ) {
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let formWidth = configuredWidth;
		if ( viewportWidth < formWidth + 20 ) {
			formWidth = viewportWidth - 20;
		}
		form.style.width = `${ formWidth }px`;

		const wasHidden = form.style.display === 'none';
		if ( wasHidden ) {
			form.style.visibility = 'hidden';
			form.style.display = 'block';
		}

		form.style.maxHeight = 'none';
		let formHeight = form.offsetHeight || 250;
		if ( formHeight > viewportHeight - 20 ) {
			formHeight = viewportHeight - 20;
		}

		if ( wasHidden ) {
			form.style.display = 'none';
			form.style.visibility = 'visible';
		}

		const scrollX = window.scrollX;
		const scrollY = window.scrollY;

		let left = absoluteX + 15;
		let top = absoluteY - 15;

		if ( left + formWidth > scrollX + viewportWidth - 10 ) {
			left = scrollX + viewportWidth - formWidth - 10;
		}
		if ( left < scrollX + 10 ) {
			left = scrollX + 10;
		}

		if ( top + formHeight > scrollY + viewportHeight - 10 ) {
			top = scrollY + viewportHeight - formHeight - 10;
		}
		if ( top < scrollY + 10 ) {
			top = scrollY + 10;
		}

		form.style.left = `${ Math.round( left ) }px`;
		form.style.top = `${ Math.round( top ) }px`;
		form.style.maxHeight = `${ viewportHeight - 20 }px`;
		form.style.overflowY = 'auto';
	}

	function repositionFormForPin( pinData ) {
		if ( ! pinData || ! pinData.element || ! pinData.formNode || pinData.formNode.style.display !== 'block' ) {
			return;
		}
		const r = pinData.element.getBoundingClientRect();
		const absX = r.left + window.scrollX + ( r.width * ( parseFloat( pinData.percentX ) / 100 ) );
		const absY = r.top + window.scrollY + ( r.height * ( parseFloat( pinData.percentY ) / 100 ) );
		updateFormPosition( pinData.formNode, absX, absY );
	}

	function bindAutoGrow( textarea, pinData ) {
		if ( ! textarea ) {
			return;
		}
		const resize = () => {
			if ( textarea.offsetParent === null ) {
				return;
			}
			textarea.style.height = 'auto';
			textarea.style.height = `${ Math.max( textarea.scrollHeight, 44 ) }px`;
			repositionFormForPin( pinData );
		};
		textarea.style.overflowY = 'hidden';
		textarea.addEventListener( 'input', resize );
		resize();
	}

	function exitAnnotatingMode() {
		isAnnotating = false;
		document.body.classList.remove( 'shanuman-va-is-annotating' );
		hideHighlight();
		const toggleBtn = document.getElementById( 'shanuman-va-toggle-btn' );
		if ( toggleBtn ) {
			toggleBtn.textContent = 'Add Comment';
			toggleBtn.style.backgroundColor = primaryColor;
		}
	}

	function markPinAndRepliesSeen( pinData, pinNode ) {
		const currentUserId = parseInt( cfg.currentUserId, 10 );
		const isPinAuthor   = currentUserId > 0 && parseInt( pinData.author_id, 10 ) === currentUserId;
		const pinSeenBy     = Array.isArray( pinData.seen_by ) ? pinData.seen_by : [];
		const isPinUnread   = ! isPinAuthor && ! pinSeenBy.includes( currentUserId ) && pinData.status === 'saved';

		if ( isPinUnread ) {
			pinData.seen_by = [ ...pinSeenBy, currentUserId ];
			if ( pinNode ) {
				pinNode.style.backgroundColor = primaryColor;
			}
			fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/seen`, {
				method: 'POST',
				headers: { 'X-WP-Nonce': cfg.nonce },
			} ).catch( () => {} );
		}

		if ( Array.isArray( pinData.replies ) ) {
			pinData.replies.forEach( ( r ) => {
				const replySeenBy = Array.isArray( r.seen_by ) ? r.seen_by : [];
				if ( parseInt( r.user_id, 10 ) !== currentUserId && ! replySeenBy.includes( currentUserId ) ) {
					r.seen_by = [ ...replySeenBy, currentUserId ];
					fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/replies/${ encodeURIComponent( r.id ) }/seen`, {
						method: 'POST',
						headers: { 'X-WP-Nonce': cfg.nonce },
					} ).catch( () => {} );
				}
			} );
			if ( pinNode ) {
				const dot = pinNode.querySelector( '.shanuman-va-unread-dot' );
				if ( dot ) {
					dot.remove();
				}
			}
		}
	}

	function renderTemporaryPin( x, y, pinData ) {
		const currentUserId = parseInt( cfg.currentUserId, 10 );
		const isPinAuthor   = currentUserId > 0 && parseInt( pinData.author_id, 10 ) === currentUserId;
		const pinSeenBy     = Array.isArray( pinData.seen_by ) ? pinData.seen_by : [];
		const isPinUnread   = ! isPinAuthor && ! pinSeenBy.includes( currentUserId ) && pinData.status === 'saved';

		const hasUnreadReply = Array.isArray( pinData.replies ) && pinData.replies.some( ( r ) => {
			return parseInt( r.user_id, 10 ) !== currentUserId && ! ( Array.isArray( r.seen_by ) ? r.seen_by : [] ).includes( currentUserId );
		} );

		let pinBgColor = primaryColor;
		let pinOutline = '2px solid #ffffff';

		if ( pinData.status === 'draft' || isPinUnread ) {
			pinBgColor = attentionColor;
		} else if ( pinData.status === 'approved' ) {
			pinBgColor = accentColor;
		} else if ( pinData.status === 'reopened' ) {
			pinBgColor = primaryColor;
			pinOutline = `2px solid ${ reopenColor }`;
		}

		const pin = document.createElement( 'div' );
		pin.className = 'shanuman-va-pin';
		pin.style.position = 'absolute';
		pin.style.left = `${ Math.round( x - 12 ) }px`;
		pin.style.top = `${ Math.round( y - 24 ) }px`;
		pin.style.width = '24px';
		pin.style.height = '24px';
		pin.style.backgroundColor = pinBgColor;
		pin.style.border = pinOutline;
		pin.style.borderRadius = '50% 50% 50% 0';
		pin.style.transform = 'rotate(-45deg)';
		pin.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
		pin.style.cursor = 'pointer';
		pin.style.zIndex = '999998';
		pin.style.display = isOverlayVisible ? 'block' : 'none';

		if ( hasUnreadReply && pinData.status !== 'draft' ) {
			const dot = document.createElement( 'span' );
			dot.className = 'shanuman-va-unread-dot';
			dot.style.cssText = `position: absolute; top: -4px; right: -4px; width: 9px; height: 9px; border-radius: 50%; background: ${ attentionColor }; border: 1.5px solid #ffffff; transform: rotate(45deg);`;
			pin.appendChild( dot );
		}

		const form = document.createElement( 'div' );
		form.className = 'shanuman-va-pin-form';
		form.style.position = 'absolute';
		form.style.backgroundColor = '#ffffff';
		form.style.border = '1px solid #ccd0d4';
		form.style.boxShadow = '0 6px 20px rgba(0,0,0,0.18)';
		form.style.padding = '14px';
		form.style.borderRadius = '6px';
		form.style.zIndex = '999999';
		form.style.boxSizing = 'border-box';
		form.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif';
		form.style.fontSize = baseFontSize;
		form.style.lineHeight = '1.45';
		form.style.color = '#1d2327';
		form.style.display = pinData.status === 'draft' ? 'block' : 'none';

		form.addEventListener( 'click', ( e ) => {
			e.stopPropagation();
		} );

		document.body.appendChild( pin );
		document.body.appendChild( form );

		pinData.domNode = pin;
		pinData.formNode = form;

		if ( pinData.status !== 'draft' ) {
			let editingReplyId = null;

			const renderThreadContent = () => {
				const isApproved = pinData.status === 'approved';
				const isMainAuthor = currentUserId > 0 && currentUserId === parseInt( pinData.author_id, 10 );
				const canDeletePin = Boolean( cfg.isAdmin || isMainAuthor );
				const flagStroke = pinData.flagged ? attentionColor : '#8c8f94';
				const flagFill = pinData.flagged ? attentionColor : 'none';

				let html = `
					<div style="margin-bottom: 10px; border-bottom: 1px solid #e2e4e7; padding-bottom: 10px;">
						<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
							<div style="font-size: ${ smallFontSize }; color: #646970; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
								<strong style="color: #1d2327;">${ escapeHtml( pinData.author_name || 'Reviewer' ) }</strong>&nbsp;&bull;&nbsp;<span>${ escapeHtml( pinData.date || '' ) }</span>
								<button type="button" class="shanuman-va-btn-flag" title="${ pinData.flagged ? 'Unflag' : 'Flag priority' }" style="background: none; border: none; padding: 0 2px; cursor: pointer; display: inline-flex; align-items: center;">
									<svg viewBox="0 0 24 24" width="14" height="14" stroke="${ flagStroke }" stroke-width="2" fill="${ flagFill }" stroke-linecap="round" stroke-linejoin="round">
										<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
										<line x1="4" y1="22" x2="4" y2="15"></line>
									</svg>
								</button>
							</div>
							<div style="display: flex; gap: 8px; align-items: center;">
								<button type="button" class="shanuman-va-btn-copy-link" style="background: none; border: none; color: #646970; cursor: pointer; font-size: ${ smallFontSize }; padding: 0;">Copy Link</button>
								${ ! isApproved ? `<button type="button" class="shanuman-va-btn-approve" style="background: none; border: none; color: ${ accentColor }; cursor: pointer; font-size: ${ smallFontSize }; padding: 0; font-weight: bold;">Approve</button>` : '' }
								${ isApproved ? `<button type="button" class="shanuman-va-btn-reopen" style="background: none; border: none; color: ${ reopenColor }; cursor: pointer; font-size: ${ smallFontSize }; padding: 0; font-weight: bold;">Reopen</button>` : '' }
								${ canDeletePin ? `<button type="button" class="shanuman-va-btn-delete" style="background: none; border: none; color: ${ attentionColor }; cursor: pointer; font-size: ${ smallFontSize }; padding: 0;">Delete</button>` : '' }
							</div>
						</div>
						<div style="font-size: ${ baseFontSize }; color: #1d2327; white-space: pre-wrap;">${ escapeHtml( pinData.comment ) }</div>
					</div>
				`;

				if ( Array.isArray( pinData.replies ) && pinData.replies.length > 0 ) {
					html += `<div class="shanuman-va-replies-list" style="margin-left: 6px; border-left: 2px solid ${ isApproved ? accentColor : primaryColor }; padding-left: 10px; margin-bottom: 10px;">`;

					pinData.replies.forEach( ( r ) => {
						const isReplyAuthor = currentUserId > 0 && currentUserId === parseInt( r.user_id, 10 );
						const canDeleteReply = Boolean( isReplyAuthor || cfg.isAdmin );
						const isEditing = editingReplyId === r.id;

						html += `<div style="margin-bottom: 10px;">
							<div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
								<div style="font-size: ${ smallFontSize }; color: #646970;">
									<strong style="color: #1d2327;">${ escapeHtml( r.author_name || 'Reviewer' ) }</strong>&nbsp;&bull;&nbsp;${ escapeHtml( r.date || '' ) }
									${ r.is_edited ? `<span title="Original: ${ escapeHtml( r.original_content || '' ) }" style="color: #8c8f94; margin-left: 4px; cursor: help;">&bull;&nbsp;Edited</span>` : '' }
								</div>
								${ ! isEditing ? `<div style="display: flex; gap: 6px;">
									${ isReplyAuthor ? `<button type="button" class="shanuman-va-btn-edit-reply" data-id="${ escapeHtml( r.id ) }" style="background: none; border: none; color: ${ primaryColor }; cursor: pointer; font-size: ${ smallFontSize }; padding: 0;">Edit</button>` : '' }
									${ canDeleteReply ? `<button type="button" class="shanuman-va-btn-delete-reply" data-id="${ escapeHtml( r.id ) }" style="background: none; border: none; color: ${ attentionColor }; cursor: pointer; font-size: ${ smallFontSize }; padding: 0;">Delete</button>` : '' }
								</div>` : '' }
							</div>`;

						if ( isEditing ) {
							html += `
								<div style="margin-top: 6px;">
									<textarea class="shanuman-va-edit-reply-input" data-id="${ escapeHtml( r.id ) }" rows="2" style="width: 100%; box-sizing: border-box; font-size: ${ baseFontSize }; padding: 6px; border: 1px solid ${ primaryColor }; border-radius: 4px; resize: none;">${ escapeHtml( r.content ) }</textarea>
									<div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px;">
										<button type="button" class="shanuman-va-btn-cancel-reply-edit" style="background: #f0f0f1; color: #2c3338; border: 1px solid #8c8f94; padding: 4px 8px; border-radius: 3px; font-size: ${ smallFontSize }; cursor: pointer;">Cancel</button>
										<button type="button" class="shanuman-va-btn-save-reply-edit" data-id="${ escapeHtml( r.id ) }" style="background: ${ primaryColor }; color: #ffffff; border: none; padding: 4px 10px; border-radius: 3px; font-size: ${ smallFontSize }; cursor: pointer;">Save</button>
									</div>
								</div>
							`;
						} else {
							html += `<div style="font-size: ${ baseFontSize }; color: #2c3338; margin-top: 3px; white-space: pre-wrap;">${ escapeHtml( r.content ) }</div>`;
						}

						html += '</div>';
					} );

					html += '</div>';
				}

				html += `
					<div style="margin-top: 8px;">
						<textarea class="shanuman-va-reply-input" placeholder="Write a reply... (Ctrl+Enter to post)" rows="2" style="width: 100%; box-sizing: border-box; font-size: ${ baseFontSize }; padding: 6px 8px; border: 1px solid #8c8f94; border-radius: 4px; resize: none;"></textarea>
						<div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px;">
							<button type="button" class="shanuman-va-submit-reply" style="background: ${ primaryColor }; color: #ffffff; border: none; padding: 5px 12px; border-radius: 3px; font-size: ${ smallFontSize }; font-weight: bold; cursor: pointer;">Reply</button>
						</div>
					</div>
				`;

				form.innerHTML = html;

				const flagBtn = form.querySelector( '.shanuman-va-btn-flag' );
				if ( flagBtn ) {
					flagBtn.addEventListener( 'click', ( e ) => {
						e.preventDefault();
						e.stopPropagation();
						isMutating = true;
						fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/flag`, {
							method: 'POST',
							headers: { 'X-WP-Nonce': cfg.nonce },
						} )
							.then( ( res ) => res.json() )
							.then( ( resData ) => {
								pinData.flagged = Boolean( resData.flagged );
								renderThreadContent();
							} )
							.finally( () => {
								isMutating = false;
							} );
					} );
				}

				const copyBtn = form.querySelector( '.shanuman-va-btn-copy-link' );
				if ( copyBtn ) {
					copyBtn.addEventListener( 'click', ( e ) => {
						e.preventDefault();
						e.stopPropagation();
						const shareUrl = new URL( window.location.href );
						shareUrl.searchParams.set( 'shanuman_va_open_pin', pinData.id );
						const textToCopy = shareUrl.toString();

						if ( navigator.clipboard && navigator.clipboard.writeText ) {
							navigator.clipboard.writeText( textToCopy ).then( () => {
								copyBtn.textContent = 'Copied!';
								setTimeout( () => {
									copyBtn.textContent = 'Copy Link';
								}, 1800 );
							} );
						} else {
							window.prompt( 'Copy Pin Link:', textToCopy );
						}
					} );
				}

				const approveBtn = form.querySelector( '.shanuman-va-btn-approve' );
				if ( approveBtn ) {
					approveBtn.addEventListener( 'click', ( e ) => {
						e.preventDefault();
						e.stopPropagation();
						approveBtn.disabled = true;
						approveBtn.textContent = 'Approving...';
						isMutating = true;
						fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/approve`, {
							method: 'POST',
							headers: { 'X-WP-Nonce': cfg.nonce },
						} )
							.then( () => {
								isMutating = false;
								loadExistingPins( false );
							} )
							.catch( () => {
								isMutating = false;
								approveBtn.disabled = false;
								approveBtn.textContent = 'Approve';
							} );
					} );
				}

				const reopenBtn = form.querySelector( '.shanuman-va-btn-reopen' );
				if ( reopenBtn ) {
					reopenBtn.addEventListener( 'click', ( e ) => {
						e.preventDefault();
						e.stopPropagation();
						reopenBtn.disabled = true;
						reopenBtn.textContent = 'Reopening...';
						isMutating = true;
						fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/reopen`, {
							method: 'POST',
							headers: { 'X-WP-Nonce': cfg.nonce },
						} )
							.then( () => {
								isMutating = false;
								loadExistingPins( false );
							} )
							.catch( () => {
								isMutating = false;
								reopenBtn.disabled = false;
								reopenBtn.textContent = 'Reopen';
							} );
					} );
				}

				const deleteBtn = form.querySelector( '.shanuman-va-btn-delete' );
				if ( deleteBtn ) {
					deleteBtn.addEventListener( 'click', ( e ) => {
						e.preventDefault();
						e.stopPropagation();
						if ( ! window.confirm( 'Are you sure you want to delete this entire thread?' ) ) {
							return;
						}
						isMutating = true;
						fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }`, {
							method: 'DELETE',
							headers: { 'X-WP-Nonce': cfg.nonce },
						} )
							.then( () => {
								pin.remove();
								form.remove();
								hideHighlight();
								const idx = activePins.findIndex( ( p ) => p.id === pinData.id );
								if ( idx > -1 ) {
									activePins.splice( idx, 1 );
								}
							} )
							.finally( () => {
								isMutating = false;
							} );
					} );
				}

				form.querySelectorAll( '.shanuman-va-btn-edit-reply' ).forEach( ( btn ) => {
					btn.addEventListener( 'click', ( e ) => {
						e.preventDefault();
						e.stopPropagation();
						editingReplyId = e.currentTarget.dataset.id;
						renderThreadContent();
					} );
				} );

				form.querySelectorAll( '.shanuman-va-btn-cancel-reply-edit' ).forEach( ( btn ) => {
					btn.addEventListener( 'click', ( e ) => {
						e.preventDefault();
						e.stopPropagation();
						editingReplyId = null;
						renderThreadContent();
					} );
				} );

				form.querySelectorAll( '.shanuman-va-btn-save-reply-edit' ).forEach( ( btn ) => {
					btn.addEventListener( 'click', ( e ) => {
						e.preventDefault();
						e.stopPropagation();
						const replyId = e.currentTarget.dataset.id;
						const input = form.querySelector( `.shanuman-va-edit-reply-input[data-id="${ replyId }"]` );
						const newText = input ? input.value.trim() : '';
						if ( ! newText ) {
							return;
						}
						btn.disabled = true;
						btn.textContent = 'Saving...';
						isMutating = true;

						fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/replies/${ encodeURIComponent( replyId ) }`, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'X-WP-Nonce': cfg.nonce,
							},
							body: JSON.stringify( { reply: newText } ),
						} )
							.then( ( res ) => res.json() )
							.then( ( data ) => {
								if ( data.replies ) {
									pinData.replies = data.replies;
									editingReplyId = null;
									renderThreadContent();
								}
							} )
							.finally( () => {
								isMutating = false;
							} );
					} );
				} );

				form.querySelectorAll( '.shanuman-va-btn-delete-reply' ).forEach( ( btn ) => {
					btn.addEventListener( 'click', ( e ) => {
						e.preventDefault();
						e.stopPropagation();
						if ( ! window.confirm( 'Delete this reply?' ) ) {
							return;
						}
						const replyId = e.currentTarget.dataset.id;
						isMutating = true;
						fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/replies/${ encodeURIComponent( replyId ) }`, {
							method: 'DELETE',
							headers: { 'X-WP-Nonce': cfg.nonce },
						} )
							.then( ( res ) => res.json() )
							.then( ( data ) => {
								if ( data.replies ) {
									pinData.replies = data.replies;
									renderThreadContent();
								}
							} )
							.finally( () => {
								isMutating = false;
							} );
					} );
				} );

				const submitReplyBtn = form.querySelector( '.shanuman-va-submit-reply' );
				const replyTextarea = form.querySelector( '.shanuman-va-reply-input' );
				if ( submitReplyBtn && replyTextarea ) {
					submitReplyBtn.addEventListener( 'click', ( e ) => {
						e.preventDefault();
						e.stopPropagation();
						const replyText = replyTextarea.value.trim();
						if ( ! replyText ) {
							return;
						}
						submitReplyBtn.disabled = true;
						submitReplyBtn.textContent = 'Posting...';
						isMutating = true;

						fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/replies`, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'X-WP-Nonce': cfg.nonce,
							},
							body: JSON.stringify( { reply: replyText } ),
						} )
							.then( ( res ) => res.json() )
							.then( ( data ) => {
								if ( data.replies ) {
									pinData.replies = data.replies;
									renderThreadContent();
								}
							} )
							.catch( () => {
								submitReplyBtn.disabled = false;
								submitReplyBtn.textContent = 'Reply';
							} )
							.finally( () => {
								isMutating = false;
							} );
					} );
				}

				bindAutoGrow( replyTextarea, pinData );
				form.querySelectorAll( '.shanuman-va-edit-reply-input' ).forEach( ( editInput ) => {
					bindAutoGrow( editInput, pinData );
				} );
				repositionFormForPin( pinData );
			};

			renderThreadContent();

			pin.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				const isVisible = form.style.display === 'block';
				document.querySelectorAll( '.shanuman-va-pin-form' ).forEach( ( f ) => {
					f.style.display = 'none';
				} );
				if ( ! isVisible ) {
					form.style.display = 'block';
					markPinAndRepliesSeen( pinData, pin );
					repositionFormForPin( pinData );
					showHighlight( pinData.element );
				} else {
					hideHighlight();
				}
			} );
		} else {
			form.innerHTML = `
				<div style="font-weight: bold; margin-bottom: 6px; font-size: ${ baseFontSize };">New Feedback</div>
				<textarea class="shanuman-va-new-comment" placeholder="Add your comment or suggestion..." rows="3" style="width: 100%; box-sizing: border-box; font-size: ${ baseFontSize }; padding: 6px 8px; border: 1px solid #8c8f94; border-radius: 4px; resize: none;"></textarea>
				<div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px;">
					<button type="button" class="shanuman-va-btn-cancel" style="background: #f0f0f1; color: #2c3338; border: 1px solid #8c8f94; padding: 5px 10px; border-radius: 3px; font-size: ${ smallFontSize }; cursor: pointer;">Cancel</button>
					<button type="button" class="shanuman-va-btn-save" style="background: ${ primaryColor }; color: #ffffff; border: none; padding: 5px 12px; border-radius: 3px; font-size: ${ smallFontSize }; font-weight: bold; cursor: pointer;">Save</button>
				</div>
			`;

			const saveBtn = form.querySelector( '.shanuman-va-btn-save' );
			const cancelBtn = form.querySelector( '.shanuman-va-btn-cancel' );
			const textarea = form.querySelector( '.shanuman-va-new-comment' );

			bindAutoGrow( textarea, pinData );

			cancelBtn.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				e.stopPropagation();
				pin.remove();
				form.remove();
				hideHighlight();
				const idx = activePins.indexOf( pinData );
				if ( idx > -1 ) {
					activePins.splice( idx, 1 );
				}
			} );

			saveBtn.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				e.stopPropagation();
				const comment = textarea.value.trim();
				if ( ! comment ) {
					return;
				}
				saveBtn.disabled = true;
				saveBtn.textContent = 'Saving...';
				isMutating = true;

				fetch( `${ cfg.restUrl }shanuman-va/v1/annotations`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': cfg.nonce,
					},
					body: JSON.stringify( {
						comment,
						xpath: pinData.xpath,
						percentX: pinData.percentX,
						percentY: pinData.percentY,
						url: window.location.pathname,
						page_title: document.title,
					} ),
				} )
					.then( ( res ) => res.json() )
					.then( () => {
						pin.remove();
						form.remove();
						hideHighlight();
						const idx = activePins.indexOf( pinData );
						if ( idx > -1 ) {
							activePins.splice( idx, 1 );
						}
						isMutating = false;
						loadExistingPins( false );
					} )
					.catch( () => {
						isMutating = false;
						saveBtn.disabled = false;
						saveBtn.textContent = 'Save';
					} );
			} );

			updateFormPosition( form, x, y );
			if ( textarea ) {
				textarea.focus();
			}
		}

		return pin;
	}

	function loadExistingPins( isInitialLoad = false ) {
		if ( isMutating ) {
			return;
		}
		const hasUnsavedDraft = activePins.some( ( p ) => p.status === 'draft' );
		if ( ! isInitialLoad && hasUnsavedDraft ) {
			return;
		}

		const currentUrl = encodeURIComponent( window.location.pathname );
		const cacheBuster = new Date().getTime();

		const currentlyOpen = activePins.find( ( p ) => p.formNode && p.formNode.style.display === 'block' );
		const openPinId = currentlyOpen ? currentlyOpen.id : null;

		const urlParams = new URLSearchParams( window.location.search );
		const autoOpenId = isInitialLoad ? ( urlParams.get( 'shanuman_va_open_pin' ) || urlParams.get( 'wp_va_open_pin' ) ) : null;
		const fetchResolved = isShowResolved || Boolean( autoOpenId );

		fetch( `${ cfg.restUrl }shanuman-va/v1/annotations?url=${ currentUrl }&show_resolved=${ fetchResolved }&t=${ cacheBuster }`, {
			headers: { 'X-WP-Nonce': cfg.nonce },
		} )
			.then( ( res ) => res.json() )
			.then( ( data ) => {
				if ( ! Array.isArray( data ) ) {
					return;
				}

				activePins.forEach( ( pin ) => {
					if ( pin.domNode ) {
						pin.domNode.remove();
					}
					if ( pin.formNode ) {
						pin.formNode.remove();
					}
				} );
				activePins.length = 0;
				hideHighlight();

				const orphanList = document.getElementById( 'shanuman-va-orphan-list' );
				const orphanCountEl = document.getElementById( 'shanuman-va-orphan-count' );
				const orphanToggle = document.getElementById( 'shanuman-va-orphan-toggle' );
				if ( orphanList ) {
					orphanList.innerHTML = '';
				}
				let orphanCount = 0;

				data.forEach( ( savedPin ) => {
					let el = null;
					try {
						el = document.evaluate( savedPin.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null ).singleNodeValue;
					} catch ( e ) {
						el = null;
					}

					if ( ! el ) {
						if ( cfg.orphanRecovery && savedPin.status !== 'approved' ) {
							if ( ! savedPin.orphaned ) {
								fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ savedPin.id }/orphan`, {
									method: 'POST',
									headers: { 'X-WP-Nonce': cfg.nonce },
								} ).catch( () => {} );
							}
							orphanCount++;
							if ( orphanList ) {
								const oItem = document.createElement( 'div' );
								oItem.style.cssText = `padding: 10px; background: #f8f9fa; border: 1px solid #ddd; margin-bottom: 8px; border-radius: 4px; font-size: ${ smallFontSize }; line-height: 1.4;`;
								oItem.innerHTML = `<strong style="color:#1d2327;">Pin #${ escapeHtml( savedPin.id ) }</strong><br/><span style="color:#646970;">Element missing from page.</span><div style="margin-top:6px; color:#2c3338;">${ escapeHtml( savedPin.comment ) }</div>`;
								orphanList.appendChild( oItem );
							}
						}
						return;
					}

					if ( cfg.orphanRecovery && savedPin.orphaned ) {
						fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ savedPin.id }/heal`, {
							method: 'POST',
							headers: { 'X-WP-Nonce': cfg.nonce },
						} ).catch( () => {} );
					}

					const r = el.getBoundingClientRect();
					const absX = r.left + window.scrollX + ( r.width * ( parseFloat( savedPin.percentX ) / 100 ) );
					const absY = r.top + window.scrollY + ( r.height * ( parseFloat( savedPin.percentY ) / 100 ) );
					const pinData = { ...savedPin, element: el, domNode: null, formNode: null };
					pinData.domNode = renderTemporaryPin( absX, absY, pinData );
					activePins.push( pinData );

					if ( openPinId && parseInt( savedPin.id, 10 ) === parseInt( openPinId, 10 ) ) {
						pinData.formNode.style.display = 'block';
						updateFormPosition( pinData.formNode, absX, absY );
						showHighlight( pinData.element );
					}
				} );

				if ( orphanCountEl ) {
					orphanCountEl.textContent = String( orphanCount );
				}
				if ( orphanToggle ) {
					orphanToggle.style.display = ( cfg.orphanRecovery && orphanCount > 0 && isOverlayVisible ) ? 'block' : 'none';
				}

				// Deep-link auto-open: snap scroll first so window.scrollY is accurate before collision detection
				if ( autoOpenId ) {
					const targetPin = activePins.find( ( p ) => parseInt( p.id, 10 ) === parseInt( autoOpenId, 10 ) );
					if ( targetPin && targetPin.domNode && targetPin.formNode && targetPin.element ) {
						targetPin.element.scrollIntoView( { behavior: 'auto', block: 'center' } );

						window.requestAnimationFrame( () => {
							document.querySelectorAll( '.shanuman-va-pin-form' ).forEach( ( f ) => {
								f.style.display = 'none';
							} );
							targetPin.formNode.style.display = 'block';
							markPinAndRepliesSeen( targetPin, targetPin.domNode );

							const elRect = targetPin.element.getBoundingClientRect();
							const absX = elRect.left + window.scrollX + ( elRect.width * ( parseFloat( targetPin.percentX ) / 100 ) );
							const absY = elRect.top + window.scrollY + ( elRect.height * ( parseFloat( targetPin.percentY ) / 100 ) );

							targetPin.domNode.style.left = `${ Math.round( absX - 12 ) }px`;
							targetPin.domNode.style.top = `${ Math.round( absY - 24 ) }px`;
							updateFormPosition( targetPin.formNode, absX, absY );
							showHighlight( targetPin.element );
						} );

						try {
							const cleanUrl = new URL( window.location.href );
							cleanUrl.searchParams.delete( 'shanuman_va_open_pin' );
							cleanUrl.searchParams.delete( 'wp_va_open_pin' );
							window.history.replaceState( {}, document.title, cleanUrl.pathname + ( cleanUrl.search ? cleanUrl.search : '' ) + cleanUrl.hash );
						} catch ( e ) {}
					}
				}
			} )
			.catch( ( err ) => console.error( 'Error loading annotations:', err ) );
	}

	function createBottomRightToolbar() {
		if ( document.getElementById( 'shanuman-va-bottom-right-toolbar' ) ) {
			return;
		}
		const tb = document.createElement( 'div' );
		tb.id = 'shanuman-va-bottom-right-toolbar';
		tb.style.cssText = 'position: fixed; z-index: 999999; display: flex; gap: 10px; align-items: center;';

		const resolvedBtn = document.createElement( 'button' );
		resolvedBtn.id = 'shanuman-va-resolved-btn';
		resolvedBtn.textContent = 'Show Approved';
		resolvedBtn.style.cssText = 'background: #1d2327; color: #ffffff; border: none; border-radius: 20px; padding: 10px 16px; font-weight: bold; font-size: 13px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.25);';
		resolvedBtn.addEventListener( 'click', ( e ) => {
			e.stopPropagation();
			isShowResolved = ! isShowResolved;
			resolvedBtn.textContent = isShowResolved ? 'Hide Approved' : 'Show Approved';
			resolvedBtn.style.backgroundColor = isShowResolved ? accentColor : '#1d2327';
			loadExistingPins( false );
		} );

		const toggleBtn = document.createElement( 'button' );
		toggleBtn.id = 'shanuman-va-toggle-btn';
		toggleBtn.textContent = 'Add Comment';
		toggleBtn.style.cssText = `background: ${ primaryColor }; color: #ffffff; border: none; border-radius: 20px; padding: 10px 18px; font-weight: bold; font-size: 13px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3);`;
		toggleBtn.addEventListener( 'click', ( e ) => {
			e.stopPropagation();
			isAnnotating = ! isAnnotating;
			if ( isAnnotating ) {
				toggleBtn.textContent = 'Exit Commenting';
				toggleBtn.style.backgroundColor = attentionColor;
				document.body.classList.add( 'shanuman-va-is-annotating' );
			} else {
				exitAnnotatingMode();
			}
		} );

		tb.appendChild( resolvedBtn );
		tb.appendChild( toggleBtn );
		document.body.appendChild( tb );
	}

	function createBottomLeftToolbar() {
		if ( document.getElementById( 'shanuman-va-bottom-left-toolbar' ) ) {
			return;
		}
		const tb = document.createElement( 'div' );
		tb.id = 'shanuman-va-bottom-left-toolbar';
		tb.style.cssText = 'position: fixed; z-index: 999999; display: flex; gap: 10px; align-items: center;';

		const mastBtn = document.createElement( 'button' );
		mastBtn.id = 'shanuman-va-master-toggle';
		mastBtn.textContent = 'Hide Annotations';
		mastBtn.style.cssText = 'background: #1d2327; color: #ffffff; border: none; border-radius: 20px; padding: 10px 16px; font-weight: bold; font-size: 13px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.25);';

		const dimBtn = document.createElement( 'button' );
		dimBtn.id = 'shanuman-va-dim-btn';
		dimBtn.textContent = 'Dim Background';
		dimBtn.style.cssText = 'background: #1d2327; color: #ffffff; border: none; border-radius: 20px; padding: 10px 16px; font-weight: bold; font-size: 13px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.25);';

		mastBtn.addEventListener( 'click', ( e ) => {
			e.stopPropagation();
			isOverlayVisible = ! isOverlayVisible;
			mastBtn.textContent = isOverlayVisible ? 'Hide Annotations' : 'Show Annotations';

			const rightTb = document.getElementById( 'shanuman-va-bottom-right-toolbar' );
			if ( rightTb ) {
				rightTb.style.display = isOverlayVisible ? 'flex' : 'none';
			}
			dimBtn.style.display = isOverlayVisible ? 'inline-block' : 'none';

			document.querySelectorAll( '.shanuman-va-pin' ).forEach( ( p ) => {
				p.style.display = isOverlayVisible ? 'block' : 'none';
			} );

			if ( ! isOverlayVisible ) {
				exitAnnotatingMode();
				document.querySelectorAll( '.shanuman-va-pin-form' ).forEach( ( f ) => {
					f.style.display = 'none';
				} );
				toggleDimBackdrop( false );
				dimBtn.textContent = 'Dim Background';
				dimBtn.style.backgroundColor = '#1d2327';
			}
		} );

		dimBtn.addEventListener( 'click', ( e ) => {
			e.stopPropagation();
			toggleDimBackdrop( ! isDimBackgroundActive );
			dimBtn.textContent = isDimBackgroundActive ? 'Remove Dimming' : 'Dim Background';
			dimBtn.style.backgroundColor = isDimBackgroundActive ? primaryColor : '#1d2327';
		} );

		tb.appendChild( mastBtn );
		tb.appendChild( dimBtn );
		document.body.appendChild( tb );
	}

	function createOrphanDrawer() {
		if ( ! cfg.orphanRecovery || document.getElementById( 'shanuman-va-orphan-drawer' ) ) {
			return;
		}
		const drawer = document.createElement( 'div' );
		drawer.id = 'shanuman-va-orphan-drawer';
		drawer.style.cssText = `position: fixed; right: -320px; top: 100px; width: 280px; max-height: 70vh; overflow-y: auto; background: #fff; border-left: 4px solid ${ attentionColor }; box-shadow: -2px 0 10px rgba(0,0,0,0.1); transition: right 0.3s ease; z-index: 999995; padding: 15px; border-radius: 8px 0 0 8px; box-sizing: border-box;`;

		const header = document.createElement( 'div' );
		header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 10px;';
		header.innerHTML = `<strong style="font-size: ${ baseFontSize }; color: ${ attentionColor };">Lost &amp; Found</strong><span id="shanuman-va-orphan-count" style="background: ${ attentionColor }; color: #fff; padding: 2px 6px; border-radius: 10px; font-size: 11px; font-weight: bold;">0</span>`;

		const list = document.createElement( 'div' );
		list.id = 'shanuman-va-orphan-list';

		const toggleBtn = document.createElement( 'button' );
		toggleBtn.id = 'shanuman-va-orphan-toggle';
		toggleBtn.innerHTML = '&#9888; Lost Pins';
		toggleBtn.style.cssText = `position: fixed; right: 0; top: 115px; background: ${ attentionColor }; color: #fff; border: none; padding: 8px 12px; border-radius: 8px 0 0 8px; cursor: pointer; z-index: 999996; font-weight: bold; box-shadow: -2px 0 5px rgba(0,0,0,0.2); transition: right 0.3s ease; display: none; font-size: ${ smallFontSize };`;

		let isOpen = false;
		toggleBtn.addEventListener( 'click', ( e ) => {
			e.stopPropagation();
			isOpen = ! isOpen;
			drawer.style.right = isOpen ? '0' : '-320px';
			toggleBtn.style.right = isOpen ? '280px' : '0';
		} );

		drawer.appendChild( header );
		drawer.appendChild( list );
		document.body.appendChild( drawer );
		document.body.appendChild( toggleBtn );
	}

	// Capture-phase click handler to drop new pins cleanly even over links/buttons
	document.addEventListener( 'click', ( e ) => {
		if ( ! isAnnotating ) {
			return;
		}
		if (
			e.target.closest( '#shanuman-va-bottom-left-toolbar' ) ||
			e.target.closest( '#shanuman-va-bottom-right-toolbar' ) ||
			e.target.closest( '#shanuman-va-orphan-drawer' ) ||
			e.target.closest( '#shanuman-va-orphan-toggle' ) ||
			e.target.closest( '.shanuman-va-pin' ) ||
			e.target.closest( '.shanuman-va-pin-form' )
		) {
			return;
		}

		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		document.querySelectorAll( '.shanuman-va-pin-form' ).forEach( ( f ) => {
			f.style.display = 'none';
		} );

		const target = e.target;
		const rect = target.getBoundingClientRect();
		const relativeX = rect.width ? ( ( e.clientX - rect.left ) / rect.width ) * 100 : 50;
		const relativeY = rect.height ? ( ( e.clientY - rect.top ) / rect.height ) * 100 : 50;

		const pinData = {
			xpath: getXPath( target ),
			percentX: relativeX.toFixed( 2 ),
			percentY: relativeY.toFixed( 2 ),
			element: target,
			domNode: null,
			formNode: null,
			comment: '',
			status: 'draft',
		};

		showHighlight( target );
		pinData.domNode = renderTemporaryPin( e.pageX, e.pageY, pinData );
		activePins.push( pinData );
		exitAnnotatingMode();
		showHighlight( target );
	}, true );

	// Outside-click handler keeps forms persistent until explicitly clicking away
	document.addEventListener( 'click', ( e ) => {
		if (
			e.target.closest( '.shanuman-va-pin' ) ||
			e.target.closest( '.shanuman-va-pin-form' ) ||
			e.target.closest( '#shanuman-va-bottom-left-toolbar' ) ||
			e.target.closest( '#shanuman-va-bottom-right-toolbar' )
		) {
			return;
		}
		document.querySelectorAll( '.shanuman-va-pin-form' ).forEach( ( form ) => {
			const parentPin = activePins.find( ( p ) => p.formNode === form );
			if ( parentPin && parentPin.status !== 'draft' ) {
				form.style.display = 'none';
			}
		} );
		if ( ! activePins.some( ( p ) => p.status === 'draft' ) ) {
			hideHighlight();
		}
	} );

	// Keyboard ergonomics: Esc to cancel/close, Ctrl/Cmd+Enter to submit active textarea
	document.addEventListener( 'keydown', ( e ) => {
		if ( ( e.ctrlKey || e.metaKey ) && 'Enter' === e.key ) {
			const activeEl = document.activeElement;
			if ( ! activeEl ) {
				return;
			}
			const form = activeEl.closest( '.shanuman-va-pin-form' );
			if ( ! form ) {
				return;
			}

			if ( activeEl.matches( '.shanuman-va-new-comment' ) ) {
				const saveBtn = form.querySelector( '.shanuman-va-btn-save' );
				if ( saveBtn && ! saveBtn.disabled ) {
					e.preventDefault();
					saveBtn.click();
				}
			} else if ( activeEl.matches( '.shanuman-va-reply-input' ) ) {
				const replyBtn = form.querySelector( '.shanuman-va-submit-reply' );
				if ( replyBtn && ! replyBtn.disabled ) {
					e.preventDefault();
					replyBtn.click();
				}
			} else if ( activeEl.matches( '.shanuman-va-edit-reply-input' ) ) {
				const replyId = activeEl.dataset.id;
				const editSaveBtn = replyId ? form.querySelector( `.shanuman-va-btn-save-reply-edit[data-id="${ replyId }"]` ) : null;
				if ( editSaveBtn && ! editSaveBtn.disabled ) {
					e.preventDefault();
					editSaveBtn.click();
				}
			}
			return;
		}

		switch ( e.key ) {
			case 'Escape':
				if ( isAnnotating ) {
					exitAnnotatingMode();
					break;
				}
				document.querySelectorAll( '.shanuman-va-pin-form' ).forEach( ( f ) => {
					f.style.display = 'none';
				} );
				hideHighlight();
				if ( isDimBackgroundActive ) {
					toggleDimBackdrop( false );
					const dimBtn = document.getElementById( 'shanuman-va-dim-btn' );
					if ( dimBtn ) {
						dimBtn.textContent = 'Dim Background';
						dimBtn.style.backgroundColor = '#1d2327';
					}
				}
				break;
			default:
				break;
		}
	} );

	// Debounced resize handler to keep pins anchored responsively
	let resizeTimeout;
	window.addEventListener( 'resize', () => {
		clearTimeout( resizeTimeout );
		resizeTimeout = setTimeout( () => {
			activePins.forEach( ( p ) => {
				if ( ! p.element || ! p.domNode || ! p.formNode ) {
					return;
				}
				const r = p.element.getBoundingClientRect();
				const absX = r.left + window.scrollX + ( r.width * ( parseFloat( p.percentX ) / 100 ) );
				const absY = r.top + window.scrollY + ( r.height * ( parseFloat( p.percentY ) / 100 ) );

				p.domNode.style.left = `${ Math.round( absX - 12 ) }px`;
				p.domNode.style.top = `${ Math.round( absY - 24 ) }px`;

				if ( p.formNode.style.display === 'block' ) {
					updateFormPosition( p.formNode, absX, absY );
					showHighlight( p.element );
				}
			} );
		}, 150 );
	} );

	createBottomRightToolbar();
	createBottomLeftToolbar();
	createOrphanDrawer();
	loadExistingPins( true );

	window.addEventListener( 'focus', () => loadExistingPins( false ) );
	document.addEventListener( 'visibilitychange', () => {
		if ( document.visibilityState === 'visible' ) {
			loadExistingPins( false );
		}
	} );
} )();