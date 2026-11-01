<?php
/**
 * Plugin Name: Shanuman Visual Annotation – Client Feedback & Review Tool
 * Description: A lightweight visual feedback and annotation tool for WordPress.
 * Version: 1.0.0
 * Author: Shanuman
 * Text Domain: shanuman-visual-annotation
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

// Exit if accessed directly for security.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class Shanuman_Visual_Annotation
 * Core singleton controller managing backend registration, REST routes, and asset injection.
 */
class Shanuman_Visual_Annotation {

    /** @var Shanuman_Visual_Annotation|null Single instance of the class. */
    private static $instance = null;

    /**
     * Retrieves the singleton instance.
     * 
     * @return Shanuman_Visual_Annotation
     */
    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor: Hooks into WordPress actions and initialization pipelines.
     */
    private function __construct() {
        add_action( 'init', [ $this, 'register_cpt_and_meta' ] );
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_frontend_assets' ] );
        add_action( 'rest_api_init', [ $this, 'register_api_endpoints' ] );
        add_action( 'admin_menu', [ $this, 'register_admin_menu' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_assets' ] );
        add_action( 'admin_init', [ $this, 'handle_reset_action' ] );
        add_action( 'transition_post_status', [ $this, 'log_post_status_change' ], 10, 3 );
    }

    /**
     * Logs internal plugin activity for administrative auditing.
     * 
     * @param string $message The log entry message.
     */
    public function log_action( $message ) {
        $logs = get_option( 'shanuman_va_activity_log', [] );$timestamp = current_time( 'Y-m-d H:i:s' );
        array_unshift( $logs, "[{$timestamp}] {$message}" );
        if ( count( $logs ) > 50 ) {
            $logs = array_slice($logs, 0, 50 );
        }
        update_option( 'shanuman_va_activity_log', $logs );
    }

    /**
     * Automatically logs feedback creation or thread deletion events when post status changes.
     */
    public function log_post_status_change( $new_status, $old_status,$post ) {
        if ( $post->post_type !== 'shanuman_va_annotation' ) return;
        if ( $old_status === 'new' && $new_status === 'publish' ) {$snippet = wp_trim_words( $post->post_content, 8, '...' );$this->log_action( "New feedback thread created (#{$post->ID}): \"{$snippet}\"" );
        } elseif ( $old_status === 'publish' && $new_status === 'trash' ) {$this->log_action( "Feedback thread deleted (#{$post->ID})." );
        }
    }

    /**
     * Handles administrator requests to factory-reset and clear all plugin data.
     */
    public function handle_reset_action() {
        if ( isset( $_POST['shanuman_va_reset_plugin_submit'] ) && check_admin_referer( 'shanuman_va_reset_action_nonce', 'shanuman_va_reset_nonce' ) ) {
            if ( current_user_can( 'manage_options' ) ) {
                $annotations = get_posts( [
                    'post_type'      => 'shanuman_va_annotation',
                    'posts_per_page' => -1,
                    'post_status'    => 'any',
                ] );
                foreach ( $annotations as$ann ) {
                    wp_delete_post( $ann->ID, true ); 
                }
                update_option( 'shanuman_va_activity_log', [] );

                $this->log_action( 'Plugin data wiped and factory reset executed by administrator.' );
                add_settings_error( 'shanuman_va_messages', 'shanuman_va_reset_success', 'All annotations, settings, and feedback threads have been permanently wiped.', 'updated' );
            }
        }
    }

    /**
     * Renders the administrative review dashboard container and activity logs.
     */
    public function render_admin_dashboard_content() {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return;
        }
        settings_errors( 'shanuman_va_messages' );
        $activity_logs = get_option( 'shanuman_va_activity_log', [] );
        ?>
        <div class="wrap">
            <h1>Shanuman Visual Annotation</h1>
            <p>Manage and review all client feedback and annotation threads left across your website.</p>
            
            <div id="shanuman-va-admin-app"><p>Loading dashboard...</p></div>

            <hr style="margin: 40px 0 20px 0;" />
            <h2>Activity Log (View-Only)</h2>
            <div style="background: #fff; border: 1px solid #ccd0d4; padding: 12px; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 12px; line-height: 1.5; box-shadow: inset 0 1px 2px rgba(0,0,0,0.07); margin-top: 10px;">
                <?php if ( empty( $activity_logs ) ) : ?>
                    <span style="color: #646970;">No activity logged yet.</span>
                <?php else : ?>
                    <?php foreach ( $activity_logs as$log ) : ?>
                        <div><?php echo esc_html( $log ); ?></div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>

            <hr style="margin: 40px 0 20px 0;" />
            <h2>Danger Zone / Reset Plugin</h2>
            <form method="post" action="" onsubmit="return confirm('Are you absolutely sure you want to wipe all annotation records and logs? This cannot be undone.');">
                <?php wp_nonce_field( 'shanuman_va_reset_action_nonce', 'shanuman_va_reset_nonce' ); ?>
                <input type="hidden" name="shanuman_va_reset_plugin_submit" value="true" />
                <?php submit_button( 'Delete All Data & Reset Plugin', 'delete', 'shanuman_va_reset_btn', false ); ?>
            </form>
        </div>
        <?php
    }

    /**
     * Registers the hidden Custom Post Type for annotations and associated REST-compatible metadata.
     */
    public function register_cpt_and_meta() {
        register_post_type( 'shanuman_va_annotation', [
            'label'               => 'Annotations',
            'public'              => false,
            'show_ui'             => false,
            'exclude_from_search' => true,
            'publicly_queryable'  => false,
            'supports'            => [ 'title', 'editor', 'author' ],
            'show_in_rest'        => true,
        ] );

        $meta_keys = [
            '_shanuman_va_coord_x'      => 'number',
            '_shanuman_va_coord_y'      => 'number',
            '_shanuman_va_rel_x'        => 'number',
            '_shanuman_va_rel_y'        => 'number',
            '_shanuman_va_target_xpath' => 'string',
            '_shanuman_va_url'          => 'string',
            '_shanuman_va_page_title'   => 'string',
            '_shanuman_va_status'       => 'string',
            '_shanuman_va_flagged'      => 'string'
        ];

        foreach ( $meta_keys as $key =>$type ) {
            register_post_meta( 'shanuman_va_annotation', $key, [
                'type'         => $type,
                'single'       => true,
                'show_in_rest' => true,
            ] );
        }
    }

    /**
     * Strict API Permission Callback ensuring authenticated users can modify annotations.
     * 
     * @param WP_REST_Request $request The incoming API request.
     * @return bool
     */
    public function api_permission_check( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return false;
        }

        $pin_id =$request->get_param( 'id' );
        if ( $pin_id ) {
            $post = get_post($pin_id );
            if ( ! $post \vert{}\vert{}$post->post_type !== 'shanuman_va_annotation' ) {
                return false; 
            }
        }

        return true;
    }

    /**
     * Registers REST API endpoints for fetching, creating, replying to, and approving pins.
     */
    public function register_api_endpoints() {
        $namespace = 'shanuman-va/v1';$route     = '/annotations';

        register_rest_route( $namespace,$route, [
            [
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => [ $this, 'get_annotations' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'create_annotation' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace,$route . '/(?P<id>\d+)', [
            [
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => [ $this, 'delete_annotation' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace,$route . '/(?P<id>\d+)/replies', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'add_annotation_reply' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace,$route . '/(?P<id>\d+)/approve', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'approve_annotation' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace,$route . '/(?P<id>\d+)/reopen', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'reopen_annotation' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace,$route . '/(?P<id>\d+)/flag', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'toggle_flag' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace,$route . '/(?P<id>\d+)/replies/(?P<reply_id>[a-zA-Z0-9_-]+)', [
            [
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => [ $this, 'update_annotation_reply' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
            [
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => [ $this, 'delete_annotation_reply' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ]
        ] );

        register_rest_route( $namespace,$route . '/(?P<id>\d+)/replies/(?P<reply_id>[a-zA-Z0-9_-]+)/seen', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'mark_reply_seen' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );
    }

    /**
     * REST Callback: Retrieves annotations filtered by URL and resolution status.
     */
    public function get_annotations( $request ) {$meta_query = [];
        $show_resolved =$request->get_param( 'show_resolved' ) === 'true';

        if ( $request->get_param( 'context' ) !== 'admin' && ! $show_resolved ) {$meta_query[] = [
                'relation' => 'OR',
                [ 'key' => '_shanuman_va_status', 'compare' => 'NOT EXISTS' ],
                [ 'key' => '_shanuman_va_status', 'value' => 'approved', 'compare' => '!=' ],
            ];
        }

        $requested_url =$request->get_param( 'url' );
        if ( ! empty( $requested_url ) ) {
            $meta_query[] = [ 'key' => '_shanuman_va_url', 'value' => sanitize_text_field($requested_url ) ];
        }

        $args = [
            'post_type'      => 'shanuman_va_annotation',
            'posts_per_page' => -1,
            'post_status'    => 'any',
        ];

        if ( ! empty( $meta_query ) ) {
            $args['meta_query'] =$meta_query;
        }

        $annotations = get_posts( $args );$data        = [];

        foreach ( $annotations as$post ) {
            $replies = get_post_meta($post->ID, '_shanuman_va_replies', true ) ?: [];
            $author = get_userdata($post->post_author );

            $data[] = [
                'id'          => $post->ID,
                'author_id'   => (int) $post->post_author,
                'author_name' => $author ? $author->display_name : 'Unknown User',
                'date'        => mysql2date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $post->post_date ),
                'comment'     => $post->post_content,
                'replies'     => $replies,
                'xpath'       => get_post_meta( $post->ID, '_shanuman_va_target_xpath', true ),
                'percentX'    => get_post_meta( $post->ID, '_shanuman_va_rel_x', true ),
                'percentY'    => get_post_meta( $post->ID, '_shanuman_va_rel_y', true ),
                'url'         => get_post_meta( $post->ID, '_shanuman_va_url', true ),
                'page_title'  => get_post_meta( $post->ID, '_shanuman_va_page_title', true ),
                'status'      => get_post_meta( $post->ID, '_shanuman_va_status', true ),
                'flagged'     => get_post_meta( $post->ID, '_shanuman_va_flagged', true ) === 'true',
            ];
        }

        return rest_ensure_response( $data );
    }

    /**
     * REST Callback: Creates a new annotation pin.
     */
    public function create_annotation( $request ) {
        $comment    = sanitize_textarea_field($request->get_param( 'comment' ) );
        $xpath      = sanitize_text_field($request->get_param( 'xpath' ) );
        $percentX   = floatval($request->get_param( 'percentX' ) );
        $percentY   = floatval($request->get_param( 'percentY' ) );
        $url        = sanitize_text_field($request->get_param( 'url' ) );
        $page_title = sanitize_text_field($request->get_param( 'page_title' ) );

        $post_id = wp_insert_post( [
            'post_title'   => 'Pin on ' . wp_date( 'M j, Y H:i' ),
            'post_content' => $comment,
            'post_type'    => 'shanuman_va_annotation',
            'post_status'  => 'publish',
            'post_author'  => get_current_user_id(),
        ] );

        if ( is_wp_error( $post_id ) \vert{}\vert{}$post_id === 0 ) {
            return new \WP_Error( 'db_insert_error', 'Could not save annotation.', [ 'status' => 500 ] );
        }

        update_post_meta( $post_id, '_shanuman_va_target_xpath',$xpath );
        update_post_meta( $post_id, '_shanuman_va_rel_x',$percentX );
        update_post_meta( $post_id, '_shanuman_va_rel_y',$percentY );
        update_post_meta( $post_id, '_shanuman_va_url',$url );
        update_post_meta( $post_id, '_shanuman_va_page_title',$page_title );
        update_post_meta( $post_id, '_shanuman_va_status', 'saved' );
        update_post_meta( $post_id, '_shanuman_va_flagged', 'false' );

        return rest_ensure_response( [ 'success' => true, 'id' => $post_id ] );
    }

    /**
     * REST Callback: Approves/resolves an annotation thread.
     */
    public function approve_annotation( $request ) {
        $post_id = absint($request->get_param( 'id' ) );
        update_post_meta( $post_id, '_shanuman_va_status', 'approved' );
        return rest_ensure_response( [ 'success' => true ] );
    }

    /**
     * REST Callback: Reopens a previously approved annotation thread.
     */
    public function reopen_annotation( $request ) {
        $post_id = absint($request->get_param( 'id' ) );
        update_post_meta( $post_id, '_shanuman_va_status', 'reopened' );
        return rest_ensure_response( [ 'success' => true ] );
    }

    /**
     * REST Callback: Toggles the flagged status of a pin.
     */
    public function toggle_flag( $request ) {
        $post_id = absint($request->get_param( 'id' ) );
        $post = get_post($post_id );
        if ( ! $post \vert{}\vert{}$post->post_type !== 'shanuman_va_annotation' ) return new \WP_Error( 'invalid_id', 'Invalid ID.', [ 'status' => 404 ] );
        
        $current = get_post_meta($post_id, '_shanuman_va_flagged', true );
        $new_val =$current === 'true' ? 'false' : 'true';
        update_post_meta( $post_id, '_shanuman_va_flagged',$new_val );
        
        return rest_ensure_response( [ 'success' => true, 'flagged' => $new_val === 'true' ] );
    }

    /**
     * REST Callback: Adds a reply to an existing annotation thread.
     */
    public function add_annotation_reply( $request ) {
        $pin_id = (int) $request['id'];
        $reply_text = sanitize_textarea_field( $request->get_param( 'reply' ) );
        $current_user = wp_get_current_user();

        $replies = get_post_meta( $pin_id, '_shanuman_va_replies', true ) ?: [];
        $new_reply = [
            'id'          => uniqid( 'reply_' ),
            'author_name' => $current_user->display_name,
            'user_id'     => $current_user->ID,
            'content'     => $reply_text,
            'date'        => mysql2date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), current_time( 'mysql' ) ),
        ];
        $replies[] = $new_reply;
        update_post_meta( $pin_id, '_shanuman_va_replies', $replies );
        
        $reply_snippet = wp_trim_words( $reply_text, 8, '...' );
        $this->log_action( "Reply added to pin #{$pin_id} by {$current_user->display_name}: \"{$reply_snippet}\"" );

        return rest_ensure_response( [ 'success' => true, 'replies' => $replies ] );
    }

    /**
     * REST Callback: Updates an existing reply.
     */
    public function update_annotation_reply( $request ) {
        $pin_id   = (int) $request->get_param( 'id' );
        $reply_id = sanitize_text_field( $request->get_param( 'reply_id' ) );
        $new_text = sanitize_textarea_field( $request->get_param( 'reply' ) );
        $replies = get_post_meta( $pin_id, '_shanuman_va_replies', true ) ?: [];
        $current_user_id = get_current_user_id();

        foreach ( $replies as $index => $reply ) {
            if ( isset( $reply['id'] ) && $reply['id'] === $reply_id ) {
                if ( (int)$reply['user_id'] !== $current_user_id ) return new \WP_Error( 'forbidden', 'Only your own replies.', [ 'status' => 403 ] );
                if ( empty( $reply['is_edited'] ) ) $replies[ $index ]['original_content'] = $reply['content'];
                $replies[ $index ]['content']   = $new_text;
                $replies[ $index ]['is_edited'] = true;
                $replies[ $index ]['seen_by']   = [ $current_user_id ];
                update_post_meta( $pin_id, '_shanuman_va_replies', $replies );
                return rest_ensure_response( [ 'success' => true, 'replies' => $replies ] );
            }
        }
        return new \WP_Error( 'not_found', 'Reply not found.', [ 'status' => 404 ] );
    }

    /**
     * REST Callback: Deletes a specific reply from a thread.
     */
    public function delete_annotation_reply( $request ) {
        $pin_id   = (int) $request->get_param( 'id' );
        $reply_id = sanitize_text_field( $request->get_param( 'reply_id' ) );
        $replies = get_post_meta( $pin_id, '_shanuman_va_replies', true ) ?: [];
        $current_user_id = get_current_user_id();
        $is_admin = current_user_can( 'manage_options' );

        $updated_replies = [];
        $deleted = false;
        foreach ( $replies as $reply ) {
            if ( isset( $reply['id'] ) && $reply['id'] === $reply_id ) {
                if ( (int)$reply['user_id'] !== $current_user_id && ! $is_admin ) {
                    return new \WP_Error( 'forbidden', 'Only your own replies can be deleted.', [ 'status' => 403 ] );
                }
                $deleted = true;
                continue; 
            }
            $updated_replies[] = $reply;
        }

        if ( ! $deleted ) return new \WP_Error( 'not_found', 'Reply not found.', [ 'status' => 404 ] );

        update_post_meta( $pin_id, '_shanuman_va_replies', $updated_replies );
        return rest_ensure_response( [ 'success' => true, 'replies' => $updated_replies ] );
    }

    /**
     * REST Callback: Marks a reply as seen by the current user.
     */
    public function mark_reply_seen( $request ) {
        $pin_id   = (int) $request->get_param( 'id' );
        $reply_id = sanitize_text_field( $request->get_param( 'reply_id' ) );
        $user_id  = get_current_user_id();
        $replies = get_post_meta( $pin_id, '_shanuman_va_replies', true ) ?: [];

        foreach ( $replies as $index => $reply ) {
            if ( isset( $reply['id'] ) && $reply['id'] === $reply_id ) {
                $seen_by = isset( $reply['seen_by'] ) && is_array( $reply['seen_by'] ) ? $reply['seen_by'] : [];
                if ( ! in_array( $user_id, $seen_by, true ) ) {
                    $seen_by[] = $user_id;
                    $replies[ $index ]['seen_by'] = $seen_by;
                    update_post_meta( $pin_id, '_shanuman_va_replies', $replies );
                }
                break;
            }
        }
        return rest_ensure_response( [ 'success' => true ] );
    }

    /**
     * REST Callback: Permanently deletes an annotation thread.
     */
    public function delete_annotation( $request ) {
        $post_id = absint( $request->get_param( 'id' ) );
        wp_delete_post( $post_id, true );
        return rest_ensure_response( [ 'success' => true ] );
    }

    /**
     * Registers the administrative menu page.
     */
    public function register_admin_menu() {
        add_menu_page( 'Shanuman Annotations', 'Annotations', 'edit_posts', 'shanuman-visual-annotations', [ $this, 'render_admin_dashboard_content' ], 'dashicons-format-chat', 30 );
    }

    /**
     * Enqueues backend dashboard scripts, styling, and localization variables (`shanumanVaConfig`).
     */
    public function enqueue_admin_assets( $hook ) {
        if ( 'toplevel_page_shanuman-visual-annotations' !== $hook ) return;
        wp_enqueue_script( 'shanuman-va-admin-js', plugin_dir_url( __FILE__ ) . 'assets/js/admin-dashboard.js', [ 'wp-element', 'wp-components', 'wp-api-fetch' ], '1.0.0', true );
        
        wp_localize_script( 'shanuman-va-admin-js', 'shanumanVaConfig', [
            'restUrl'        => esc_url_raw( rest_url() ),
            'nonce'          => wp_create_nonce( 'wp_rest' ),
            'currentUserId'  => get_current_user_id(),
            'isAdmin'        => current_user_can( 'manage_options' ),
            'buttonColor'    => '#2271b1',
            'accentColor'    => '#46b450',
            'reopenColor'    => '#f56e28',
            'attentionColor' => '#d63638',
        ] );
        wp_enqueue_style( 'wp-components' );
    }

    /**
     * Enqueues frontend overlay scripts and localization variables (`shanumanVaConfig`) for editors.
     */
    public function enqueue_frontend_assets() {
        if ( ! current_user_can( 'edit_posts' ) ) return;
        if ( is_archive() || is_search() || is_home() ) return;

        wp_enqueue_script( 'shanuman-va-frontend', plugin_dir_url( __FILE__ ) . 'assets/js/frontend-overlay.js', [], '1.0.0', true );
        wp_localize_script( 'shanuman-va-frontend', 'shanumanVaConfig', [
            'restUrl'        => esc_url_raw( rest_url() ),
            'nonce'          => wp_create_nonce( 'wp_rest' ),
            'currentUserId'  => get_current_user_id(),
            'isAdmin'        => current_user_can( 'manage_options' ),
            'buttonColor'    => '#2271b1',
            'accentColor'    => '#46b450',
            'reopenColor'    => '#f56e28',
            'attentionColor' => '#d63638',
            'formWidth'      => 340,
        ] );
    }
}

// Initialize the plugin singleton.
Shanuman_Visual_Annotation::get_instance();