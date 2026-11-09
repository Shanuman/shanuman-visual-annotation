=== Shanuman Visual Annotation ===
Contributors: shanuman
Tags: visual feedback, annotation, client feedback, website review, bug tracker
Requires at least: 5.8
Tested up to: 7.1
Stable tag: 1.0.3
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A lightweight visual feedback and annotation tool for WordPress. Pin comments directly onto your website elements.

== Description ==

Shanuman Visual Annotation transforms your WordPress website into a live, interactive feedback canvas. Built specifically for agencies, freelancers, and site owners, this lightweight tool allows logged-in editors to leave precise, element-anchored comments directly on the frontend of the website. 

Stop wrestling with messy spreadsheets and confusing screenshots. With Shanuman Visual Annotation, clients can simply click any element on the page, drop a pin, and type their feedback.

### Features
* **Element-Anchored Pins:** Click anywhere on the page to drop a visual pin perfectly anchored to the underlying HTML element.
* **Live Threaded Discussions:** Reply to feedback and have full conversations directly on the page.
* **Resolution Workflow:** Easily track feedback status by marking pins as "Approved" when the task is complete.
* **Smart Dimming Layer:** A built-in dark overlay ensures that your feedback pins always stand out, regardless of the website's background color or design.
* **Centralized Dashboard:** Review, manage, and bulk-delete feedback threads across your entire website from a clean, React-powered backend dashboard.
* **Flag Important Items:** Mark critical feedback threads with a high-priority flag to ensure they get handled first.
* **Unread Notifications:** Visual indicators let you know instantly when a client has left a new reply on a thread.

### Zero Bloat
This plugin is built with pure, native Vanilla JS and the native WordPress `wp.element` library. It contains zero heavy build tools, no Webpack, and no jQuery dependencies. 

**Developer Note on Source Code:** The JavaScript in this plugin (frontend-overlay.js and admin-dashboard.js) is written entirely in native Vanilla JS utilizing the native WordPress wp.element library directly. No build tools, Webpack, NPM, or minification processes are used. Development and raw source code can be found at: https://github.com/shanuman/shanuman-visual-annotation

== Installation ==

1. Upload the `shanuman-visual-annotation` folder to the `/wp-content/plugins/` directory, or install directly through the WordPress plugins screen.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Log in as an Administrator or Editor.
4. Visit the frontend of your website and click the "Add Comment" button in the bottom right corner to begin annotating!

== Frequently Asked Questions ==

= Who can see and leave annotations? =
Only users who are logged in and have the `edit_posts` capability (Administrators and Editors) can see the annotation interface and leave feedback. Your regular website visitors will never see the pins.

= Where do I manage all the feedback? =
In your WordPress admin sidebar, click on the "Annotations" menu item to access the centralized management dashboard. 

= Does this work on mobile? =
Yes! The annotation overlay and toolbars are fully responsive and work seamlessly on mobile devices.

== Screenshots ==

1. The frontend annotation interface with a live feedback pin.
2. The centralized backend management dashboard.
3. An active threaded discussion on a specific webpage element.

== Changelog ==

= 1.0.0 =
* Initial public release.

= 1.0.1 =
* Minor bug fixes.

= 1.0.2 =
* Minor bug fixes.
* Make front-end form element responsive.

= 1.0.3 =
* Minor bug fixes.
* Added font-size injection from pro add-on.