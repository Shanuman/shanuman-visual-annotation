/* global shanumanVaConfig */
( function () {
	// 1. Dynamic Configuration Extraction from Pro Add-on
	const cfg = typeof shanumanVaConfig !== 'undefined' ? shanumanVaConfig : {};
	const primaryColor    = cfg.buttonColor || '#2271b1';
	const accentColor     = cfg.accentColor || '#46b450';
	const reopenColor     = cfg.reopenColor || '#f56e28';
	const attentionColor  = cfg.attentionColor || '#d63638';
	const dimColor        = cfg.dimColor || '#000000';
	const dimOpacity      = ( cfg.dimOpacity !== undefined && cfg.dimOpacity !== '' ) ? parseFloat( cfg.dimOpacity ) : 0.7;
	const configuredWidth = parseInt( cfg.formWidth, 10 ) || 340;

	const activePins = [];
	let isAnnotating = false;
	let highlightBox = null;
	let isShowResolved = false;
	let isOverlayVisible = true; 
	let isLargeAccessibilityMode = false; 
	let isDimBackgroundActive = false; 
	let dimBackdropNode = null;
	let isMutating = false; // Prevents focus listeners from racing during confirm/actions

	const responsiveStyle = document.createElement( 'style' );
	responsiveStyle.innerHTML = `
		#shanuman-va-bottom-left-toolbar, #shanuman-va-bottom-right-toolbar { 
			pointer-events: none !important;
			flex-wrap: wrap !important;
		}
		#shanuman-va-bottom-left-toolbar > *, #shanuman-va-bottom-right-toolbar > * { 
			pointer-events: auto !important;
		}
		#shanuman-va-bottom-left-toolbar { bottom: 20px !important; left: 20px !important; }
		#shanuman-va-bottom-right-toolbar { bottom: 20px !important; right: 20px !important; }
		
		@media (max-width: 768px) {
			#shanuman-va-bottom-left-toolbar { bottom: 15px !important; left: 10px !important; right: 10px !important; justify-content: center !important; }
			#shanuman-va-bottom-right-toolbar { bottom: 85px !important; left: 10px !important; right: 10px !important; justify-content: center !important; }
			#shanuman-va-bottom-left-toolbar button, #shanuman-va-bottom-right-toolbar button { 
				font-size: 12px !important; 
				padding: 8px 14px !important; 
				border-radius: 16px !important; 
				white-space: nowrap !important; 
				margin: 0 !important; 
			}
		}
	`;
	document.head.appendChild( responsiveStyle );

	const hexToRgb = ( hex ) => {
		let c;
		if ( /^#([A-Fa-f0-9]{3}){1,2}$/.test( hex ) ) {
			c = hex.substring( 1 ).split( '' );
			if ( c.length === 3 ) { c = [ c[0], c[0], c[1], c[1], c[2], c[2] ]; }
			c = '0x' + c.join( '' );
			return [ ( c >> 16 ) & 255, ( c >> 8 ) & 255, c & 255 ].join( ',' );
		}
		return '0, 0, 0';
	};

	const cursorStyle = document.createElement( 'style' );
	cursorStyle.innerHTML = 'body.shanuman-va-is-annotating * { cursor: crosshair !important; }';
	document.head.appendChild( cursorStyle );

	function getActiveFormWidth() {
		return isLargeAccessibilityMode ? ( configuredWidth + 100 ) : configuredWidth;
	}

	function showHighlight( element ) {
		if ( ! element ) return;
		if ( ! highlightBox ) {
			highlightBox = document.createElement( 'div' );
			highlightBox.id = 'shanuman-va-target-highlight';
			highlightBox.style.position = 'absolute';
			highlightBox.style.boxSizing = 'border-box'; 
			highlightBox.style.border = `2px solid ${attentionColor}`;
			highlightBox.style.backgroundColor = `rgba(${hexToRgb( attentionColor )}, 0.08)`;
			highlightBox.style.pointerEvents = 'none';
			highlightBox.style.zIndex = '999997';
			highlightBox.style.transition = 'all 0.2s ease-in-out';
			document.body.appendChild( highlightBox );
		} else {
			highlightBox.style.border = `2px solid ${attentionColor}`;
			highlightBox.style.backgroundColor = `rgba(${hexToRgb( attentionColor )}, 0.08)`;
		}
		const rect = element.getBoundingClientRect();
		highlightBox.style.left = `${ rect.left + window.scrollX }px`;
		highlightBox.style.top = `${ rect.top + window.scrollY }px`;
		highlightBox.style.width = `${ rect.width }px`;
		highlightBox.style.height = `${ rect.height }px`;
		highlightBox.style.display = 'block';
	}

	function hideHighlight() { 
		if ( highlightBox ) highlightBox.style.display = 'none'; 
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
					document.querySelectorAll( '.shanuman-va-pin-form' ).forEach( ( f ) => ( f.style.display = 'none' ) );
					hideHighlight();
					toggleDimBackdrop( false );
					const dimBtn = document.getElementById( 'shanuman-va-dim-btn' );
					if ( dimBtn ) { dimBtn.textContent = 'Dim Background'; dimBtn.style.backgroundColor = '#1d2327'; }
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
		if ( ! element || element.nodeType !== 1 ) return '';
		if ( element.id && ! element.id.startsWith( 'shanuman-va-' ) ) return `//*[@id="${ element.id }"]`;
		const parts = [];
		let current = element;
		while ( current && current.nodeType === 1 ) {
			const tagName = current.nodeName.toLowerCase();
			if ( tagName === 'body' ) { parts.unshift( '//body' ); break; }
			if ( current.id && ! current.id.startsWith( 'shanuman-va-' ) ) { parts.unshift( `//*[@id="${ current.id }"]` ); break; }
			if ( [ 'footer', 'header', 'main' ].includes( tagName ) ) {
				if ( document.getElementsByTagName( tagName ).length === 1 ) { parts.unshift( `//${ tagName }` ); break; }
			}
			let index = 1; 
			let sibling = current.previousElementSibling;
			while ( sibling ) {
				if ( sibling.nodeName.toLowerCase() === tagName && ! sibling.id.startsWith( 'shanuman-va-' ) && ! sibling.classList.contains( 'shanuman-va-pin' ) ) index++;
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
		
		let formWidth = getActiveFormWidth();
		if ( viewportWidth < formWidth + 20 ) formWidth = viewportWidth - 20; 
		form.style.width = `${formWidth}px`; 

		const wasHidden = form.style.display === 'none';
		if ( wasHidden ) { form.style.visibility = 'hidden'; form.style.display = 'block'; }
		const formHeight = form.offsetHeight || 250;
		if ( wasHidden ) { form.style.display = 'none'; form.style.visibility = 'visible'; }

		const scrollX = window.scrollX;
		const scrollY = window.scrollY;
		
		let left = absoluteX + 15;
		let top = absoluteY - 15;

		if ( left + formWidth > scrollX + viewportWidth - 10 ) left = scrollX + viewportWidth - formWidth - 10;
		if ( left < scrollX + 10 ) left = scrollX + 10;
		if ( top + formHeight > scrollY + viewportHeight - 10 ) top = scrollY + viewportHeight - formHeight - 10;
		if ( top < scrollY + 10 ) top = scrollY + 10;

		form.style.left = `${ Math.round( left ) }px`;
		form.style.top = `${ Math.round( top ) }px`;
	}

	function renderTemporaryPin( x, y, pinData ) {
		let pinBgColor = primaryColor; 
		let pinOutline = '2px solid #ffffff'; 

		if ( pinData.status === 'draft' ) {
			pinBgColor = attentionColor;
		} else if ( pinData.status === 'approved' ) {
			pinBgColor = accentColor; 
		} else if ( pinData.status === 'reopened' ) {
			pinBgColor = primaryColor; 
			pinOutline = `2px solid ${reopenColor}`; 
		}

		const pin = document.createElement( 'div' );
		pin.className = 'shanuman-va-pin';
		pin.style.cssText = `position: absolute; left: ${Math.round(x - 12)}px; top: ${Math.round(y - 24)}px; width: 24px; height: 24px; background-color: ${pinBgColor}; border: ${pinOutline}; box-sizing: border-box; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); cursor: pointer; z-index: 999998; box-shadow: 2px -2px 4px rgba(0,0,0,0.2); display: ${isOverlayVisible ? 'block' : 'none'};`;

		const currentUserId = parseInt( cfg.currentUserId, 10 );
		const hasUnread = ( pinData.replies || [] ).some( r => parseInt( r.user_id, 10 ) !== currentUserId && !( Array.isArray( r.seen_by ) ? r.seen_by : [] ).includes( currentUserId ) );
		
		if ( hasUnread && pinData.status !== 'draft' ) {
			const unreadDot = document.createElement( 'div' );
			unreadDot.className = 'shanuman-va-unread-dot';
			unreadDot.style.cssText = `position: absolute; top: -4px; right: -4px; width: 10px; height: 10px; background-color: ${attentionColor}; border-radius: 50%; border: 2px solid #fff; transform: rotate(45deg);`;
			pin.appendChild( unreadDot );
		}

		document.body.appendChild( pin );
		pinData.domNode = pin;

		const form = document.createElement( 'div' );
		form.className = 'shanuman-va-pin-form';
		form.style.cssText = `position: absolute; background-color: #ffffff; border: 1px solid ${pinBgColor}; box-shadow: 0 6px 20px rgba(0,0,0,0.25); padding: ${isLargeAccessibilityMode ? '18px' : '14px'}; border-radius: 6px; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: ${isLargeAccessibilityMode ? '16px' : '13px'}; display: ${(pinData.status === 'draft' && isOverlayVisible) ? 'block' : 'none'}; box-sizing: border-box;`;
		document.body.appendChild( form );
		pinData.formNode = form;

		if ( pinData.status === 'saved' || pinData.status === 'approved' || pinData.status === 'reopened' ) {
			let editingReplyId = null;

			const renderThreadContent = () => {
				const isApproved = pinData.status === 'approved';
				const baseFontSize = isLargeAccessibilityMode ? '15px' : '13px';
				const smallFontSize = isLargeAccessibilityMode ? '13px' : '11px';
				const flagColor = pinData.flagged ? attentionColor : '#8c8f94';
				const flagFill = pinData.flagged ? attentionColor : 'none';

				let threadHtml = `
					<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 6px;">
						<button type="button" class="shanuman-va-accessibility-toggle" style="background: #f0f0f1; border: 1px solid #8c8f94; border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; font-weight: bold;">${ isLargeAccessibilityMode ? 'Standard Size' : 'A+ Larger View' }</button>
						<span style="font-size: 11px; color: #646970;">Pin #${ pinData.id }</span>
					</div>
					<div style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
						<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
							<div style="font-size: ${ smallFontSize }; color: #646970; display: flex; align-items: center;">
								<strong>${ pinData.author_name || 'Author' }</strong> &bull; ${ pinData.date || '' }
								<svg class="shanuman-va-btn-flag" viewBox="0 0 24 24" width="14" height="14" stroke="${flagColor}" stroke-width="2" fill="${flagFill}" stroke-linecap="round" stroke-linejoin="round" style="cursor: pointer; margin-left: 8px;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
							</div>
							<div style="display: flex; gap: 8px;">
								${ !isApproved ? `<button type="button" class="shanuman-va-btn-approve" style="background: none; border: none; color: ${ accentColor }; cursor: pointer; font-size:${ smallFontSize }; padding: 0; font-weight: bold;">Approve</button>` : `<button type="button" class="shanuman-va-btn-reopen" style="background: none; border: none; color: ${ reopenColor }; cursor: pointer; font-size:${ smallFontSize }; padding: 0; font-weight: bold;">Reopen</button>` }
							</div>
						</div>
						<div style="font-size: ${ baseFontSize }; color: #1d2327; margin-top: 4px; line-height: 1.4;">${ pinData.comment }</div>
					</div>`;

				if ( pinData.replies && pinData.replies.length > 0 ) {
					threadHtml += `<div class="shanuman-va-replies-list" style="margin-left: 8px; border-left: 2px solid ${pinBgColor}; padding-left: 8px; margin-bottom: 10px; max-height: ${ isLargeAccessibilityMode ? '220px' : '150px' }; overflow-y: auto;">`;
					pinData.replies.forEach( r => {
						const isReplyAuthor = parseInt( r.user_id, 10 ) === currentUserId;
						const canDeleteReply = isReplyAuthor || cfg.isAdmin;
						const isUnread = !isReplyAuthor && !( Array.isArray( r.seen_by ) ? r.seen_by : [] ).includes( currentUserId );
						const showBadge = isUnread || r.is_edited;
						const badgeColor = isUnread ? attentionColor : '#a7aaad';
						
						threadHtml += `<div style="margin-bottom: 8px;"><div style="display: flex; justify-content: space-between; align-items: center;"><div style="font-size: ${ smallFontSize }; color: #646970; display: flex; align-items: center;"><strong>${ r.author_name }</strong>&nbsp;&bull;&nbsp;${ r.date }&nbsp;&bull;&nbsp;${ showBadge ? `<span class="shanuman-va-edited-badge" data-pin-id="${ pinData.id }" data-reply-id="${ r.id }" data-unread="${ isUnread }" title="${ r.is_edited ? 'Original: '+r.original_content : 'Unread' }" style="color: ${ badgeColor }; font-weight: ${ isUnread ? 'bold' : 'normal' }; cursor: help; display: inline-flex; align-items: center; gap: 4px;">${ isUnread && !r.is_edited ? 'New' : 'Edited' } <span class="shanuman-va-info-circle" style="display: inline-flex; justify-content: center; align-items: center; width: 14px; height: 14px; background-color: ${ badgeColor }; color: #fff; border-radius: 50%; font-size: 10px; font-weight: bold;">${ isUnread && !r.is_edited ? '!' : 'i' }</span></span>` : '' }</div><div style="display: flex; gap: 8px;">${ isReplyAuthor && editingReplyId !== r.id ? `<button type="button" class="shanuman-va-btn-edit-reply" data-id="${ r.id }" style="background: none; border: none; color: ${ primaryColor }; cursor: pointer; font-size:${ smallFontSize }; padding: 0;">Edit</button>` : '' }${ canDeleteReply && editingReplyId !== r.id ? `<button type="button" class="shanuman-va-btn-delete-reply" data-id="${ r.id }" style="background: none; border: none; color: #d63638; cursor: pointer; font-size: ${ smallFontSize }; padding: 0;">Delete</button>` : '' }</div></div>`;

						if ( editingReplyId === r.id ) {
							threadHtml += `<div style="margin-top: 4px;"><textarea class="shanuman-va-edit-reply-input" data-id="${ r.id }" rows="3" style="width: 100%; box-sizing: border-box; font-size: ${ baseFontSize }; padding: 6px; border: 1px solid ${ primaryColor }; border-radius: 4px;">${ r.content }</textarea><div style="display: flex; justify-content: flex-end; gap: 4px; margin-top: 4px;"><button type="button" class="shanuman-va-btn-cancel-reply-edit" style="background: #f0f0f1; border: 1px solid #8c8f94; padding: 4px 8px; border-radius: 3px; font-size: ${ smallFontSize }; cursor: pointer;">Cancel</button><button type="button" class="shanuman-va-btn-save-reply-edit" data-id="${ r.id }" style="background: ${ primaryColor }; color: #fff; border: none; padding: 4px 8px; border-radius: 3px; font-size: ${ smallFontSize }; cursor: pointer;">Save</button></div></div>`;
						} else {
							threadHtml += `<div style="font-size: ${ baseFontSize }; color: #2c3338; margin-top: 2px; line-height: 1.4; font-weight: ${ isUnread ? 'bold' : 'normal' };">${ r.content }</div>`;
						}
						threadHtml += `</div>`;
					});
					threadHtml += '</div>';
				}

				threadHtml += `<div style="margin-top: 8px;"><textarea class="shanuman-va-reply-input" placeholder="Write a reply or status update..." rows="${ isLargeAccessibilityMode ? '4' : '2' }" style="width: 100%; box-sizing: border-box; font-size: ${ baseFontSize }; padding: 6px; border: 1px solid #8c8f94; border-radius: 4px;"></textarea><div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px;"><button type="button" class="shanuman-va-submit-reply" style="background: ${ primaryColor }; color: #fff; border: none; padding: ${ isLargeAccessibilityMode ? '6px 14px' : '4px 10px' }; border-radius: 3px; font-size: ${ baseFontSize }; cursor: pointer; transition: opacity 0.2s ease;">Reply</button></div></div>`;
				form.innerHTML = threadHtml;

				form.querySelector( '.shanuman-va-btn-flag' ).addEventListener( 'click', (e) => {
					e.stopPropagation();
					pinData.flagged = !pinData.flagged;
					renderThreadContent();
					fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/flag`, { method: 'POST', headers: { 'X-WP-Nonce': cfg.nonce } } ).catch(()=>{});
				});

				const accessToggle = form.querySelector( '.shanuman-va-accessibility-toggle' );
				if ( accessToggle ) accessToggle.addEventListener( 'click', (e) => { 
					e.stopPropagation();
					isLargeAccessibilityMode = ! isLargeAccessibilityMode; 
					updateFormPosition( form, parseInt( pin.style.left ) + 12, parseInt( pin.style.top ) + 24 );
					renderThreadContent();
				} );

				const approveBtn = form.querySelector( '.shanuman-va-btn-approve' );
				if ( approveBtn ) approveBtn.addEventListener( 'click', (e) => { 
					e.stopPropagation(); 
					approveBtn.textContent = '...'; 
					fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/approve`, { method: 'POST', headers: { 'X-WP-Nonce': cfg.nonce } } )
					.then( () => { pinData.status = 'approved'; loadExistingPins(); } ); 
				} );

				const reopenBtn = form.querySelector( '.shanuman-va-btn-reopen' );
				if ( reopenBtn ) reopenBtn.addEventListener( 'click', (e) => { 
					e.stopPropagation(); 
					reopenBtn.textContent = '...'; 
					fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/reopen`, { method: 'POST', headers: { 'X-WP-Nonce': cfg.nonce } } )
					.then( () => { pinData.status = 'reopened'; loadExistingPins(); } ); 
				} );

				form.querySelectorAll( '.shanuman-va-btn-edit-reply' ).forEach( btn => btn.addEventListener( 'click', ( e ) => { 
					e.preventDefault(); 
					e.stopPropagation(); 
					editingReplyId = btn.dataset.id; 
					renderThreadContent(); 
				} ) );

				form.querySelectorAll( '.shanuman-va-btn-cancel-reply-edit' ).forEach( btn => btn.addEventListener( 'click', ( e ) => { 
					e.preventDefault(); 
					e.stopPropagation(); 
					editingReplyId = null; 
					renderThreadContent(); 
				} ) );

				form.querySelectorAll( '.shanuman-va-btn-save-reply-edit' ).forEach( btn => btn.addEventListener( 'click', ( e ) => {
					e.preventDefault();
					e.stopPropagation();
					if ( btn.disabled ) return;
					const replyId = btn.dataset.id; 
					const newText = form.querySelector( `.shanuman-va-edit-reply-input[data-id="${ replyId }"]` ).value.trim(); 
					if ( ! newText ) return;
					
					btn.textContent = 'Posting...'; 
					btn.disabled = true; 
					btn.style.opacity = '0.6';
					isMutating = true;
					
					fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/replies/${ encodeURIComponent( replyId ) }`, { 
						method: 'POST', 
						headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce }, 
						body: JSON.stringify( { reply: newText } ) 
					} )
					.then( res => res.json() )
					.then( data => { 
						if ( data && data.replies !== undefined ) { 
							pinData.replies = Array.isArray( data.replies ) ? data.replies : Object.values( data.replies ); 
							editingReplyId = null; 
							renderThreadContent(); 
						} 
					} )
					.catch(()=>{ btn.textContent = 'Save'; btn.disabled = false; btn.style.opacity = '1'; })
					.finally(() => { isMutating = false; });
				} ) );

				form.querySelectorAll( '.shanuman-va-btn-delete-reply' ).forEach( btn => btn.addEventListener( 'click', ( e ) => {
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();

					isMutating = true;
					const confirmed = window.confirm( 'Are you sure you want to delete this reply?' );
					if ( ! confirmed ) {
						isMutating = false;
						return;
					}

					const replyId = btn.dataset.id;
					btn.textContent = '...';
					btn.style.pointerEvents = 'none';
					
					fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/replies/${ encodeURIComponent( replyId ) }`, { 
						method: 'DELETE', 
						headers: { 'X-WP-Nonce': cfg.nonce } 
					} )
					.then( res => res.json() )
					.then( data => { 
						if ( data && data.replies !== undefined ) { 
							pinData.replies = Array.isArray( data.replies ) ? data.replies : Object.values( data.replies ); 
							renderThreadContent(); 
						} 
					} )
					.finally(() => {
						isMutating = false;
					});
				} ) );

				const submitBtn = form.querySelector( '.shanuman-va-submit-reply' );
				const replyInput = form.querySelector( '.shanuman-va-reply-input' );
				if ( submitBtn && replyInput ) submitBtn.addEventListener( 'click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					if ( submitBtn.disabled ) return;
					const txt = replyInput.value.trim(); 
					if ( ! txt ) return;
					
					submitBtn.textContent = 'Posting...'; 
					submitBtn.disabled = true; 
					submitBtn.style.opacity = '0.6';
					isMutating = true;
					
					fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/replies`, { 
						method: 'POST', 
						headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce }, 
						body: JSON.stringify( { reply: txt } ) 
					} )
					.then( res => res.json() )
					.then( data => { 
						if ( data && data.replies !== undefined ) { 
							pinData.replies = Array.isArray( data.replies ) ? data.replies : Object.values( data.replies ); 
							replyInput.value = '';
							submitBtn.textContent = 'Reply';
							submitBtn.disabled = false;
							submitBtn.style.opacity = '1';
							renderThreadContent(); 
						} 
					} )
					.catch(()=>{ submitBtn.textContent = 'Reply'; submitBtn.disabled = false; submitBtn.style.opacity = '1'; })
					.finally(() => { isMutating = false; });
				});

				form.querySelectorAll( '.shanuman-va-edited-badge' ).forEach( badge => {
					if ( badge.dataset.unread === 'true' ) badge.addEventListener( 'mouseenter', (e) => {
						e.stopPropagation();
						badge.style.color = '#a7aaad'; 
						badge.style.fontWeight = 'normal'; 
						badge.dataset.unread = 'false';
						const c = badge.querySelector( '.shanuman-va-info-circle' ); 
						if ( c ) c.style.backgroundColor = '#a7aaad';
						fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ badge.dataset.pinId }/replies/${ encodeURIComponent( badge.dataset.replyId ) }/seen`, { 
							method: 'POST', 
							headers: { 'X-WP-Nonce': cfg.nonce } 
						} ).catch(()=>{});
					}, { once: true } );
				});
			};

			renderThreadContent();

			pin.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				const isVisible = form.style.display === 'block';
				document.querySelectorAll( '.shanuman-va-pin-form' ).forEach( f => f.style.display = 'none' );
				if ( ! isVisible ) {
					form.style.display = 'block';
					if ( pinData.replies ) {
						pinData.replies.forEach( r => {
							if ( parseInt( r.user_id, 10 ) !== currentUserId && !( Array.isArray( r.seen_by ) ? r.seen_by : [] ).includes( currentUserId ) ) {
								fetch( `${ cfg.restUrl }shanuman-va/v1/annotations/${ pinData.id }/replies/${ encodeURIComponent( r.id ) }/seen`, { method: 'POST', headers: { 'X-WP-Nonce': cfg.nonce } } ).catch(()=>{});
							}
						});
					}
					const dot = pin.querySelector( '.shanuman-va-unread-dot' ); 
					if ( dot ) dot.remove();
					const elRect = pinData.element.getBoundingClientRect();
					updateFormPosition( form, elRect.left + window.scrollX + ( elRect.width * ( pinData.percentX / 100 ) ), elRect.top + window.scrollY + ( elRect.height * ( pinData.percentY / 100 ) ) );
					showHighlight( pinData.element );
				} else { 
					form.style.display = 'none'; 
					hideHighlight(); 
				}
			} );
		} else {
			const bFS = isLargeAccessibilityMode ? '15px' : '13px'; 
			const sFS = isLargeAccessibilityMode ? '13px' : '11px'; 
			const pS = isLargeAccessibilityMode ? '10px' : '6px';
			
			form.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 6px;"><button type="button" class="shanuman-va-accessibility-toggle" style="background: #f0f0f1; border: 1px solid #8c8f94; border-radius: 4px; padding: 2px 8px; font-size: ${sFS}; cursor: pointer; font-weight: bold;">${ isLargeAccessibilityMode ? 'Standard Size' : 'A+ Larger View' }</button><span style="font-size: ${sFS}; font-weight: bold;">New Feedback</span></div><textarea class="shanuman-va-new-comment" placeholder="Add your comment..." rows="${ isLargeAccessibilityMode ? '5' : '3' }" style="width: 100%; box-sizing: border-box; font-size: ${bFS}; padding: ${pS}; border: 1px solid #8c8f94; border-radius: 4px; resize: vertical;"></textarea><div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px;"><button type="button" class="shanuman-va-btn-cancel" style="background: #f0f0f1; border: 1px solid #8c8f94; padding: ${ isLargeAccessibilityMode ? '6px 14px' : '4px 10px' }; border-radius: 3px; font-size: ${bFS}; cursor: pointer;">Cancel</button><button type="button" class="shanuman-va-btn-save" style="background: ${primaryColor}; color: #fff; border: none; padding: ${ isLargeAccessibilityMode ? '6px 14px' : '4px 10px' }; border-radius: 3px; font-size: ${bFS}; cursor: pointer; transition: opacity 0.2s ease;">Save</button></div>`;
			
			const accTgl = form.querySelector( '.shanuman-va-accessibility-toggle' );
			if ( accTgl ) accTgl.addEventListener( 'click', (e) => { 
				e.stopPropagation();
				isLargeAccessibilityMode = ! isLargeAccessibilityMode; 
				const txt = form.querySelector( '.shanuman-va-new-comment' ).value; 
				pin.remove(); 
				form.remove(); 
				pinData.domNode = renderTemporaryPin( parseInt( pin.style.left ) + 12, parseInt( pin.style.top ) + 24, pinData ); 
				pinData.formNode.querySelector( '.shanuman-va-new-comment' ).value = txt; 
				pinData.formNode.style.display = 'block'; 
				updateFormPosition( pinData.formNode, parseInt( pin.style.left ) + 12, parseInt( pin.style.top ) + 24 ); 
			} );

			form.querySelector( '.shanuman-va-btn-cancel' ).addEventListener( 'click', (e) => { 
				e.stopPropagation(); 
				pin.remove(); 
				form.remove(); 
				hideHighlight(); 
				const idx = activePins.indexOf( pinData ); 
				if ( idx > -1 ) activePins.splice( idx, 1 ); 
			} );
			
			form.querySelector( '.shanuman-va-btn-save' ).addEventListener( 'click', (e) => {
				e.stopPropagation();
				if ( e.target.disabled ) return;
				const cmt = form.querySelector( '.shanuman-va-new-comment' ).value.trim(); 
				if ( ! cmt ) return;
				
				e.target.textContent = 'Posting...'; 
				e.target.disabled = true; 
				e.target.style.opacity = '0.6';
				isMutating = true;
				
				fetch( `${ cfg.restUrl }shanuman-va/v1/annotations`, { 
					method: 'POST', 
					headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce }, 
					body: JSON.stringify( { comment: cmt, xpath: pinData.xpath, percentX: pinData.percentX, percentY: pinData.percentY, url: window.location.pathname, page_title: document.title } ) 
				} )
				.then( () => { 
					pin.remove(); 
					form.remove(); 
					hideHighlight(); 
					loadExistingPins(); 
				} )
				.catch(()=>{ 
					e.target.textContent = 'Save'; 
					e.target.disabled = false; 
					e.target.style.opacity = '1'; 
				})
				.finally(() => {
					isMutating = false;
				});
			} );
		}

		if ( form.style.display === 'block' ) updateFormPosition( form, x, y );
		return pin;
	}

	function loadExistingPins() {
		const currentUrl = encodeURIComponent( window.location.pathname );
		const cacheBuster = new Date().getTime();

		const currentlyOpen = activePins.find( p => p.formNode && p.formNode.style.display === 'block' );
		const openPinId = currentlyOpen ? currentlyOpen.id : null;

		fetch( `${ cfg.restUrl }shanuman-va/v1/annotations?url=${ currentUrl }&show_resolved=${ isShowResolved }&t=${ cacheBuster }`, { 
			headers: { 'X-WP-Nonce': cfg.nonce } 
		} )
		.then( res => res.json() ).then( data => {
			if ( ! Array.isArray( data ) ) return;
			activePins.forEach( pin => { if( pin.domNode ) pin.domNode.remove(); if( pin.formNode ) pin.formNode.remove(); } );
			activePins.length = 0; 
			hideHighlight();

			data.forEach( savedPin => {
				let el = null; 
				try { el = document.evaluate( savedPin.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null ).singleNodeValue; } catch ( e ) {}
				if ( ! el ) return;
				const r = el.getBoundingClientRect();
				const absX = r.left + window.scrollX + ( r.width * ( parseFloat( savedPin.percentX ) / 100 ) );
				const absY = r.top + window.scrollY + ( r.height * ( parseFloat( savedPin.percentY ) / 100 ) );
				const pinData = { ...savedPin, element: el, domNode: null, formNode: null };
				pinData.domNode = renderTemporaryPin( absX, absY, pinData );
				activePins.push( pinData );

				if ( openPinId && savedPin.id === openPinId ) {
					pinData.formNode.style.display = 'block';
					updateFormPosition( pinData.formNode, absX, absY );
					showHighlight( pinData.element );
				}
			} );
		} );
	}

	function createBottomRightToolbar() {
		if ( document.getElementById( 'shanuman-va-bottom-right-toolbar' ) ) return;
		const tb = document.createElement( 'div' );
		tb.id = 'shanuman-va-bottom-right-toolbar';
		tb.style.cssText = 'position: fixed !important; z-index: 999999 !important; display: flex !important; gap: 10px !important; align-items: center !important;';

		const resBtn = document.createElement( 'button' );
		resBtn.id = 'shanuman-va-toggle-resolved-btn';
		resBtn.textContent = 'Show Approved';
		resBtn.style.cssText = `background-color: #fff; color: #2c3338; border: 1px solid #8c8f94; border-radius: 20px; padding: 10px 18px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.2); font-family: sans-serif; font-size: 14px; display: ${isOverlayVisible ? 'block' : 'none'};`;
		resBtn.addEventListener( 'click', (e) => {
			e.stopPropagation();
			isShowResolved = !isShowResolved;
			resBtn.textContent = isShowResolved ? 'Hide Approved' : 'Show Approved';
			resBtn.style.borderColor = isShowResolved ? accentColor : '#8c8f94';
			resBtn.style.color = isShowResolved ? accentColor : '#2c3338';
			loadExistingPins();
		} );

		const addBtn = document.createElement( 'button' );
		addBtn.id = 'shanuman-va-toggle-btn';
		addBtn.textContent = 'Add Comment';
		addBtn.style.cssText = `background-color: ${primaryColor}; color: #fff; border: none; border-radius: 20px; padding: 10px 18px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-family: sans-serif; font-size: 14px; display: ${isOverlayVisible ? 'block' : 'none'};`;
		addBtn.addEventListener( 'click', (e) => {
			e.stopPropagation();
			isAnnotating = !isAnnotating;
			addBtn.textContent = isAnnotating ? 'Exit Commenting' : 'Add Comment';
			addBtn.style.backgroundColor = isAnnotating ? attentionColor : primaryColor;
			if ( isAnnotating ) document.body.classList.add( 'shanuman-va-is-annotating' );
			else { document.body.classList.remove( 'shanuman-va-is-annotating' ); hideHighlight(); }
		} );

		tb.appendChild( resBtn );
		tb.appendChild( addBtn );
		document.body.appendChild( tb );
	}

	function createBottomLeftToolbar() {
		if ( document.getElementById( 'shanuman-va-bottom-left-toolbar' ) ) return;
		const tb = document.createElement( 'div' );
		tb.id = 'shanuman-va-bottom-left-toolbar';
		tb.style.cssText = 'position: fixed !important; z-index: 999999 !important; display: flex !important; gap: 10px !important; align-items: center !important;';

		const mastBtn = document.createElement( 'button' );
		mastBtn.id = 'shanuman-va-master-toggle-btn';
		mastBtn.textContent = 'Hide Annotations';
		mastBtn.style.cssText = 'background-color: #1d2327; color: #fff; border: none; border-radius: 20px; padding: 10px 18px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-family: sans-serif; font-size: 14px;';
		mastBtn.addEventListener( 'click', (e) => {
			e.stopPropagation();
			isOverlayVisible = !isOverlayVisible;
			mastBtn.textContent = isOverlayVisible ? 'Hide Annotations' : 'Show Annotations';

			const rightToolbar = document.getElementById( 'shanuman-va-bottom-right-toolbar' );
			if ( rightToolbar ) rightToolbar.style.setProperty( 'display', isOverlayVisible ? 'flex' : 'none', 'important' );

			const dimBtnEl = document.getElementById( 'shanuman-va-dim-btn' );
			if ( dimBtnEl ) dimBtnEl.style.setProperty( 'display', isOverlayVisible ? 'block' : 'none', 'important' );

			activePins.forEach( p => {
				if ( p.domNode ) p.domNode.style.display = isOverlayVisible ? 'block' : 'none';
				if ( ! isOverlayVisible && p.formNode ) p.formNode.style.display = 'none';
			} );

			if ( ! isOverlayVisible ) {
				hideHighlight();
				toggleDimBackdrop( false );
				if ( dimBtnEl ) { dimBtnEl.textContent = 'Dim Background'; dimBtnEl.style.backgroundColor = '#1d2327'; }
				if ( isAnnotating ) {
					isAnnotating = false;
					document.body.classList.remove( 'shanuman-va-is-annotating' );
					const ab = document.getElementById( 'shanuman-va-toggle-btn' );
					if ( ab ) { ab.textContent = 'Add Comment'; ab.style.backgroundColor = primaryColor; }
				}
			}
		} );

		const dimBtn = document.createElement( 'button' );
		dimBtn.id = 'shanuman-va-dim-btn';
		dimBtn.textContent = 'Dim Background';
		dimBtn.style.cssText = 'background-color: #1d2327; color: #fff; border: none; border-radius: 20px; padding: 10px 18px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-family: sans-serif; font-size: 14px;';
		dimBtn.addEventListener( 'click', (e) => {
			e.stopPropagation();
			const n = ! isDimBackgroundActive;
			toggleDimBackdrop( n );
			dimBtn.textContent = n ? 'Undim Background' : 'Dim Background';
			dimBtn.style.backgroundColor = n ? primaryColor : '#1d2327';
		} );

		tb.appendChild( mastBtn );
		tb.appendChild( dimBtn );
		document.body.appendChild( tb );
	}

	document.addEventListener( 'click', ( e ) => {
		if ( ! isAnnotating ) return;
		if ( e.target.closest('#shanuman-va-bottom-right-toolbar') || e.target.closest('#shanuman-va-bottom-left-toolbar') || e.target.closest('.shanuman-va-pin') || e.target.closest('.shanuman-va-pin-form') ) return;
		e.preventDefault(); 
		e.stopPropagation(); 
		e.stopImmediatePropagation();
		
		const r = e.target.getBoundingClientRect();
		const pinData = { 
			xpath: getXPath( e.target ), 
			percentX: ( ( ( e.clientX - r.left ) / r.width ) * 100 ).toFixed( 2 ), 
			percentY: ( ( ( e.clientY - r.top ) / r.height ) * 100 ).toFixed( 2 ), 
			element: e.target, 
			domNode: null, 
			formNode: null, 
			status: 'draft' 
		};
		showHighlight( e.target );
		pinData.domNode = renderTemporaryPin( e.pageX, e.pageY, pinData );
		activePins.push( pinData );
	}, true );

	loadExistingPins();
	createBottomRightToolbar();
	createBottomLeftToolbar();

	// Guard focus and visibility syncing from wiping open windows or racing actions
	function handleSafeSync() {
		if ( isMutating ) return;
		const openForm = activePins.find( p => p.formNode && p.formNode.style.display === 'block' );
		if ( openForm ) return;
		loadExistingPins();
	}

	window.addEventListener( 'focus', handleSafeSync );
	document.addEventListener( 'visibilitychange', () => {
		if ( document.visibilityState === 'visible' ) {
			handleSafeSync();
		}
	} );

	document.addEventListener( 'click', ( e ) => {
		if ( ! e.target || ! e.target.isConnected ) {
			return;
		}

		const path = e.composedPath ? e.composedPath() : [];
		const isInsideInteractive = path.some( el => {
			return ( el.classList && (
				el.classList.contains( 'shanuman-va-pin' ) ||
				el.classList.contains( 'shanuman-va-pin-form' )
			) ) || (
				el.id && (
					el.id === 'shanuman-va-dim-btn' ||
					el.id === 'shanuman-va-bottom-right-toolbar' ||
					el.id === 'shanuman-va-bottom-left-toolbar'
				)
			);
		} );

		if ( isInsideInteractive ) {
			return;
		}

		let closed = false;
		document.querySelectorAll( '.shanuman-va-pin-form' ).forEach( f => {
			const p = activePins.find( x => x.formNode === f );
			if ( p && p.status !== 'draft' && f.style.display === 'block' ) { 
				f.style.display = 'none'; 
				closed = true; 
			}
		} );

		if ( closed ) { 
			hideHighlight(); 
			toggleDimBackdrop( false ); 
			const db = document.getElementById( 'shanuman-va-dim-btn' ); 
			if ( db ) { 
				db.textContent = 'Dim Background'; 
				db.style.backgroundColor = '#1d2327'; 
			} 
		}
	} );
} )();