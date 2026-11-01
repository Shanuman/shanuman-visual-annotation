=== Shanuman Visual Annotation ===
Contributors: shanuman
Tags: visual feedback, annotation, client review, bug tracker
Requires at least: 6.0
Tested up to: 7.1
Stable tag: 1.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Let clients point, click, and comment directly on your website. A lightweight, privacy-first visual feedback tool for rapid design approvals.

== Description ==

**Shanuman Visual Annotation** is a streamlined, WordPress-native visual feedback tool built specifically for web developers, designers, and creative agencies. It allows you and your clients to leave comments directly on top of website elements, pinning feedback precisely where it belongs.
Developer Note on Source Code: The JavaScript in this plugin (frontend-overlay.js and admin-dashboard.js) is written entirely in native Vanilla JS utilizing the native WordPress wp.element library directly. No build tools, Webpack, NPM, or minification processes are used. Development and raw source code can be found at: https://github.com/Shanuman/shanuman-visual-annotation 


Instead of paying expensive monthly per-user fees for third-party SaaS tools, this plugin keeps all your client feedback secure, private, and hosted right inside your own WordPress database.

### Core Features
*   **Point-and-Click Feedback:** Drop pins on any DOM element on the frontend of your website.
*   **Advanced XPath Anchoring:** Pins intelligently lock onto HTML elements, surviving window resizing and mobile responsive shifts.
*   **Centralised Dashboard:** View, reply to, and approve client feedback directly from the WordPress backend.
*   **Mobile-First Design:** Both the frontend annotation overlay and the backend dashboard are 100% mobile responsive.
*   **Brand Customisation:** Set your primary button colours to match your brand identity.
*   **Lightweight & Fast:** Built with vanilla JavaScript and the WordPress REST API—no jQuery bloat or heavy external libraries.

== Installation ==

1. Upload the `shanuman-visual-annotation` folder to the `/wp-content/plugins/` directory, or install directly through the WordPress plugins screen.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Navigate to **Annotations -> Settings** in the WordPress menu to set your primary brand colour.
4. Visit the frontend of your website and click **Add Comment** in the bottom right corner to start dropping pins!

== Frequently Asked Questions ==

= Will this slow down my website? =
No. Shanuman Visual Annotation is highly optimised. It uses lightweight, native vanilla JavaScript and only loads for logged-in users with the correct permissions (Administrators/Editors). Your regular website visitors will not load the script at all.

= What happens if I change my website layout? =
The plugin uses advanced XPath calculations and percentage-based coordinates to anchor pins. If the screen size changes (like viewing on mobile), the pins will scale and stay attached to their target elements.

= Where is my feedback stored? =
All annotations, threads, and metadata are stored securely within your own WordPress database as a custom post type. No data is sent to external servers.

= Who can leave feedback? =
Users must be logged into WordPress with the capability to edit posts (Administrators and Editors) to leave and manage annotations. 

== Screenshots ==

1. The frontend visual annotation overlay and comment threads.
2. The backend client feedback dashboard.
3. Responsive mobile view for on-the-go approvals.
4. The plugin settings panel.

== Changelog ==

= 1.0.0 =
* Initial release on the WordPress repository! Includes core XPath anchoring, frontend overlay, and backend management dashboard.