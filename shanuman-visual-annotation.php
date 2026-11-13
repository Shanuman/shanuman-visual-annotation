<?php
/**
 * Plugin Name: Shanuman Visual Annotation
 * Plugin URI: https://wordpress.org/plugins/shanuman-visual-annotation/
 * Description: A lightweight visual feedback and annotation tool for WordPress.
 * Version: 1.0.3
 * Author: Shanuman
 * Author URI:
 * Text Domain: shanuman-visual-annotation
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Shanuman_Visual_Annotation {

    private static $instance = null;

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'init', [ $this, 'register_cpt_and_meta' ] );
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_frontend_assets' ] );
        add_action( 'rest_api_init', [ $this, 'register_api_endpoints' ] );
        add_action( 'admin_menu', [ $this, 'register_admin_menu' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_assets' ] );
        add_action( 'admin_init', [ $this, 'handle_reset_action' ] );
        add_action( 'transition_post_status', [ $this, 'log_post_status_change' ], 10, 3 );
        add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), [ $this, 'add_plugin_action_links' ] );
    }

    public function add_plugin_action_links( $links ) {
        $custom_links = [
            '<a href="' . admin_url( 'admin.php?page=shanuman-visual-annotations' ) . '">Dashboard</a>',
        ];
        return array_merge( $custom_links, $links );
    }

    public function log_action( $message ) {
        $logs      = get_option( 'shanuman_va_activity_log', [] );
        $timestamp = current_time( 'Y-m-d H:i:s' );
        array_unshift( $logs, "[{$timestamp}] {$message}" );
        update_option( 'shanuman_va_activity_log', $logs, false );
    }

    public function log_post_status_change( $new_status, $old_status, $post ) {
        if ( $post->post_type !== 'shanuman_pin' ) return;
        if ( $old_status === 'new' && $new_status === 'publish' ) {
            $snippet = wp_trim_words( $post->post_content, 8, '...' );
            $this->log_action( "New feedback thread created (#{$post->ID}): \"{$snippet}\"" );
        } elseif ( $old_status === 'publish' && $new_status === 'trash' ) {
            $this->log_action( "Feedback thread deleted (#{$post->ID})." );
        }
    }

    public function handle_reset_action() {
        if ( isset( $_POST['shanuman_va_reset_plugin_submit'] ) ) {
            if ( ! isset( $_POST['shanuman_va_reset_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['shanuman_va_reset_nonce'] ) ), 'shanuman_va_reset_action_nonce' ) ) {
                return;
            }
            if ( current_user_can( 'manage_options' ) ) {
                $annotations = get_posts( [
                    'post_type'      => 'shanuman_pin',
                    'posts_per_page' => -1,
                    'post_status'    => 'any',
                ] );
                foreach ( $annotations as $ann ) {
                    wp_delete_post( $ann->ID, true );
                }
                update_option( 'shanuman_va_activity_log', [], false );
                do_action( 'shanuman_va_after_plugin_reset' );

                $this->log_action( 'Plugin data wiped and factory reset executed by administrator.' );
                add_settings_error( 'shanuman_va_messages', 'shanuman_va_reset_success', 'All annotations, settings, and feedback threads have been permanently wiped.', 'updated' );
            }
        }
    }

    public function render_admin_dashboard_content() {
        if ( ! current_user_can( 'edit_posts' ) ) return;
        settings_errors( 'shanuman_va_messages' );
        
        $activity_logs = get_option( 'shanuman_va_activity_log', [] );
        $per_page      = 20;
        $total_logs    = count( $activity_logs );
        $total_pages   = max( 1, ceil( $total_logs / $per_page ) );
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $current_page  = isset( $_GET['log_page'] ) ? max( 1, min( $total_pages, absint( $_GET['log_page'] ) ) ) : 1;
        $offset        = ( $current_page - 1 ) * $per_page;
        $paged_logs    = array_slice( $activity_logs, $offset, $per_page );
        ?>
        <div class="wrap">
            <h1>Shanuman Visual Annotation</h1>
            <p>Manage and review all client feedback and annotation threads left across your website.</p>
            
            <div id="shanuman-va-admin-app"><p>Loading dashboard...</p></div>

            <hr style="margin: 40px 0 20px 0;" />
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2>Activity Log (View-Only)</h2>
                <?php do_action( 'shanuman_va_activity_log_header' ); ?>
            </div>
            <div style="background: #fff; border: 1px solid #ccd0d4; padding: 12px; max-height: 250px; overflow-y: auto; font-family: monospace; font-size: 12px; line-height: 1.5; box-shadow: inset 0 1px 2px rgba(0,0,0,0.07); margin-top: 10px;">
                <?php if ( empty( $paged_logs ) ) : ?>
                    <span style="color: #646970;">No activity logged yet.</span>
                <?php else : ?>
                    <?php foreach ( $paged_logs as $log ) : ?>
                        <div style="padding: 2px 0; border-bottom: 1px solid #f0f0f1;"><?php echo esc_html( $log ); ?></div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>

            <?php if ( $total_pages > 1 ) : ?>
                <div class="tablenav bottom" style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <div class="displaying-num" style="color: #646970; font-size: 12px;">
                        <?php echo esc_html( sprintf( 'Showing %d–%d of %d entries', $offset + 1, min( $offset + $per_page, $total_logs ), $total_logs ) ); ?>
                    </div>
                    <div class="tablenav-pages" style="display: flex; gap: 6px; align-items: center;">
                        <?php if ( $current_page > 1 ) : ?>
                            <a class="button small" href="<?php echo esc_url( add_query_arg( 'log_page', $current_page - 1 ) ); ?>">&laquo; Previous</a>
                        <?php endif; ?>
                        <span style="font-size: 12px; padding: 0 6px;">
                            Page <?php echo esc_html( $current_page ); ?> of <?php echo esc_html( $total_pages ); ?>
                        </span>
                        <?php if ( $current_page < $total_pages ) : ?>
                            <a class="button small" href="<?php echo esc_url( add_query_arg( 'log_page', $current_page + 1 ) ); ?>">Next &raquo;</a>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endif; ?>

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

    public function register_cpt_and_meta() {
        register_post_type( 'shanuman_pin', [
            'label'               => 'Annotations',
            'public'              => false,
            'show_ui'             => false,
            'exclude_from_search' => true,
            'publicly_queryable'  => false,
            'supports'            => [ 'title', 'editor', 'author' ],
            'show_in_rest'        => true,
        ] );

        $meta_keys = apply_filters( 'shanuman_va_registered_meta_keys', [
            '_shanuman_va_coord_x'      => 'number',
            '_shanuman_va_coord_y'      => 'number',
            '_shanuman_va_rel_x'        => 'number',
            '_shanuman_va_rel_y'        => 'number',
            '_shanuman_va_target_xpath' => 'string',
            '_shanuman_va_url'          => 'string',
            '_shanuman_va_page_title'   => 'string',
            '_shanuman_va_status'       => 'string',
            '_shanuman_va_flagged'      => 'string',
        ] );

        foreach ( $meta_keys as $key => $type ) {
            register_post_meta( 'shanuman_pin', $key, [
                'type'         => $type,
                'single'       => true,
                'show_in_rest' => true,
            ] );
        }
    }

    public function api_permission_check( $request ) {
        $has_access = apply_filters( 'shanuman_va_api_permission', current_user_can( 'edit_posts' ), $request );
        if ( ! $has_access ) return false;

        $pin_id = $request->get_param( 'id' );
        if ( $pin_id ) {
            $post = get_post( $pin_id );
            if ( ! $post || $post->post_type !== 'shanuman_pin' ) return false;
        }
        return true;
    }

    public function register_api_endpoints() {
        $namespace = 'shanuman-va/v1';
        $route     = '/annotations';

        register_rest_route( $namespace, $route, [
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

        register_rest_route( $namespace, $route . '/(?P<id>\d+)', [
            [
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => [ $this, 'delete_annotation' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace, $route . '/(?P<id>\d+)/replies', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'add_annotation_reply' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace, $route . '/(?P<id>\d+)/approve', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'approve_annotation' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace, $route . '/(?P<id>\d+)/reopen', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'reopen_annotation' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace, $route . '/(?P<id>\d+)/flag', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'toggle_flag' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace, $route . '/(?P<id>\d+)/replies/(?P<reply_id>[a-zA-Z0-9_-]+)', [
            [
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => [ $this, 'update_annotation_reply' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
            [
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => [ $this, 'delete_annotation_reply' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );

        register_rest_route( $namespace, $route . '/(?P<id>\d+)/replies/(?P<reply_id>[a-zA-Z0-9_-]+)/seen', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'mark_reply_seen' ],
                'permission_callback' => [ $this, 'api_permission_check' ],
            ],
        ] );
		// Endpoint for marking the parent pin itself as seen
		register_rest_route( $namespace, $route . '/(?P<id>\d+)/seen', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'mark_pin_seen' ],
				'permission_callback' => [ $this, 'api_permission_check' ],
			],
		] );

        do_action( 'shanuman_va_register_rest_routes', $namespace, $route, $this );
    }

    public function get_annotations( $request ) {
        $meta_query    = [];
        $show_resolved = $request->get_param( 'show_resolved' ) === 'true';

        if ( $request->get_param( 'context' ) !== 'admin' && ! $show_resolved ) {
            $meta_query[] = [
                'relation' => 'OR',
                [ 'key' => '_shanuman_va_status', 'compare' => 'NOT EXISTS' ],
                [ 'key' => '_shanuman_va_status', 'value' => 'approved', 'compare' => '!=' ],
            ];
        }

        $requested_url = $request->get_param( 'url' );
        if ( ! empty( $requested_url ) ) {
            $meta_query[] = [ 'key' => '_shanuman_va_url', 'value' => sanitize_text_field( $requested_url ) ];
        }

        $args = [
            'post_type'      => 'shanuman_pin',
            'posts_per_page' => -1,
            'post_status'    => 'any',
        ];

        // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
        if ( ! empty( $meta_query ) ) {
            $args['meta_query'] = $meta_query;
        }

        $annotations = get_posts( $args );
        $data        = [];

		foreach ( $annotations as $post ) {
			$replies = get_post_meta( $post->ID, '_shanuman_va_replies', true ) ?: [];
			$author  = get_userdata( $post->post_author );

			$guest_name = get_post_meta( $post->ID, '_shanuman_va_guest_name', true );
			if ( empty( $guest_name ) ) {
				$guest_name = 'Guest Reviewer';
			}

			$author_name = $author ? $author->display_name : ( get_post_meta( $post->ID, '_shanuman_va_guest_name', true ) ?: 'Guest Reviewer' );

			$item = [
				'id'          => $post->ID,
				'author_id'   => (int) $post->post_author,
				'author_name' => $author_name,
				'date'        => mysql2date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $post->post_date ),
				'comment'     => $post->post_content,
				'replies'     => $replies,
				'seen_by'     => get_post_meta( $post->ID, '_shanuman_va_seen_by', true ) ?: [], // <-- NEW
				'xpath'       => get_post_meta( $post->ID, '_shanuman_va_target_xpath', true ),
				'percentX'    => get_post_meta( $post->ID, '_shanuman_va_rel_x', true ),
				'percentY'    => get_post_meta( $post->ID, '_shanuman_va_rel_y', true ),
				'url'         => get_post_meta( $post->ID, '_shanuman_va_url', true ),
				'page_title'  => get_post_meta( $post->ID, '_shanuman_va_page_title', true ),
				'status'      => get_post_meta( $post->ID, '_shanuman_va_status', true ),
				'flagged'     => get_post_meta( $post->ID, '_shanuman_va_flagged', true ) === 'true',
			];

			$data[] = apply_filters( 'shanuman_va_annotation_response_item', $item, $post );
		}

        return rest_ensure_response( $data );
    }

    public function create_annotation( $request ) {
        $comment    = sanitize_textarea_field( $request->get_param( 'comment' ) );
        $xpath      = sanitize_text_field( $request->get_param( 'xpath' ) );
        $percentX   = floatval( $request->get_param( 'percentX' ) );
        $percentY   = floatval( $request->get_param( 'percentY' ) );
        $url        = sanitize_text_field( $request->get_param( 'url' ) );
        $page_title = sanitize_text_field( $request->get_param( 'page_title' ) );

        $post_id = wp_insert_post( [
            'post_title'   => 'Pin on ' . wp_date( 'M j, Y H:i' ),
            'post_content' => $comment,
            'post_type'    => 'shanuman_pin',
            'post_status'  => 'publish',
            'post_author'  => get_current_user_id(),
        ] );

        if ( is_wp_error( $post_id ) || $post_id === 0 ) {
            return new \WP_Error( 'db_insert_error', 'Could not save annotation.', [ 'status' => 500 ] );
        }

        update_post_meta( $post_id, '_shanuman_va_target_xpath', $xpath );
        update_post_meta( $post_id, '_shanuman_va_rel_x', $percentX );
        update_post_meta( $post_id, '_shanuman_va_rel_y', $percentY );
        update_post_meta( $post_id, '_shanuman_va_url', $url );
        update_post_meta( $post_id, '_shanuman_va_page_title', $page_title );
        update_post_meta( $post_id, '_shanuman_va_status', 'saved' );
        update_post_meta( $post_id, '_shanuman_va_flagged', 'false' );
		update_post_meta( $post_id, '_shanuman_va_seen_by', [ get_current_user_id() ] ); // NEW

        do_action( 'shanuman_va_after_create_annotation', $post_id, $request );

        return rest_ensure_response( [ 'success' => true, 'id' => $post_id ] );
    }

    public function approve_annotation( $request ) {
        $post_id = absint( $request->get_param( 'id' ) );
        update_post_meta( $post_id, '_shanuman_va_status', 'approved' );
        return rest_ensure_response( [ 'success' => true ] );
    }

    public function reopen_annotation( $request ) {
        $post_id = absint( $request->get_param( 'id' ) );
        update_post_meta( $post_id, '_shanuman_va_status', 'reopened' );
        return rest_ensure_response( [ 'success' => true ] );
    }

    public function toggle_flag( $request ) {
        $post_id = absint( $request->get_param( 'id' ) );
        $post    = get_post( $post_id );
        if ( ! $post || $post->post_type !== 'shanuman_pin' ) {
            return new \WP_Error( 'invalid_id', 'Invalid ID.', [ 'status' => 404 ] );
        }

        $current = get_post_meta( $post_id, '_shanuman_va_flagged', true );
        $new_val = $current === 'true' ? 'false' : 'true';
        update_post_meta( $post_id, '_shanuman_va_flagged', $new_val );

        return rest_ensure_response( [ 'success' => true, 'flagged' => $new_val === 'true' ] );
    }

    public function add_annotation_reply( $request ) {
        $pin_id       = (int) $request['id'];
        $reply_text   = sanitize_textarea_field( $request->get_param( 'reply' ) );
        $current_user = wp_get_current_user();
        $author_name  = $current_user->ID ? $current_user->display_name : apply_filters( 'shanuman_va_guest_author_name', 'Guest Reviewer', $request );

        $replies   = get_post_meta( $pin_id, '_shanuman_va_replies', true ) ?: [];
        $new_reply = [
            'id'          => uniqid( 'reply_' ),
            'author_name' => $author_name,
            'user_id'     => $current_user->ID,
            'content'     => $reply_text,
            'date'        => mysql2date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), current_time( 'mysql' ) ),
        ];
        $replies[] = $new_reply;
        update_post_meta( $pin_id, '_shanuman_va_replies', $replies );

        $reply_snippet = wp_trim_words( $reply_text, 8, '...' );
        $this->log_action( "Reply added to pin #{$pin_id} by {$author_name}: \"{$reply_snippet}\"" );

        return rest_ensure_response( [ 'success' => true, 'replies' => $replies ] );
    }

    public function update_annotation_reply( $request ) {
        $pin_id          = (int) $request->get_param( 'id' );
        $reply_id        = sanitize_text_field( trim( $request->get_param( 'reply_id' ) ) );
        $new_text        = sanitize_textarea_field( $request->get_param( 'reply' ) );
        $replies         = get_post_meta( $pin_id, '_shanuman_va_replies', true ) ?: [];
        $current_user_id = get_current_user_id();

        foreach ( $replies as $index => $reply ) {
            if ( isset( $reply['id'] ) && trim( $reply['id'] ) === $reply_id ) {
                if ( (int) $reply['user_id'] !== $current_user_id ) {
                    return new \WP_Error( 'forbidden', 'Only your own replies.', [ 'status' => 403 ] );
                }
                if ( empty( $reply['is_edited'] ) ) {
                    $replies[ $index ]['original_content'] = $reply['content'];
                }
                $replies[ $index ]['content']   = $new_text;
                $replies[ $index ]['is_edited'] = true;
                $replies[ $index ]['seen_by']   = [ $current_user_id ];
                update_post_meta( $pin_id, '_shanuman_va_replies', $replies );
                return rest_ensure_response( [ 'success' => true, 'replies' => $replies ] );
            }
        }
        return new \WP_Error( 'not_found', 'Reply not found.', [ 'status' => 404 ] );
    }

    public function delete_annotation_reply( $request ) {
        $pin_id          = (int) $request->get_param( 'id' );
        $reply_id        = sanitize_text_field( trim( $request->get_param( 'reply_id' ) ) );
        $replies         = get_post_meta( $pin_id, '_shanuman_va_replies', true ) ?: [];
        $current_user_id = get_current_user_id();
        $is_admin        = current_user_can( 'manage_options' );

        $updated_replies = [];
        $deleted         = false;
        foreach ( $replies as $reply ) {
            if ( isset( $reply['id'] ) && trim( $reply['id'] ) === $reply_id ) {
                if ( (int) $reply['user_id'] !== $current_user_id && ! $is_admin ) {
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
	
	public function mark_pin_seen( $request ) {
        $pin_id  = (int) $request->get_param( 'id' );
        $user_id = get_current_user_id();
        $seen_by = get_post_meta( $pin_id, '_shanuman_va_seen_by', true ) ?: [];
        
        if ( ! is_array( $seen_by ) ) {
            $seen_by = [];
        }
        
        if ( ! in_array( $user_id, $seen_by, true ) ) {
            $seen_by[] = $user_id;
            update_post_meta( $pin_id, '_shanuman_va_seen_by', $seen_by );
        }
        return rest_ensure_response( [ 'success' => true ] );
    }

    public function mark_reply_seen( $request ) {
        $pin_id   = (int) $request->get_param( 'id' );
        $reply_id = sanitize_text_field( trim( $request->get_param( 'reply_id' ) ) );
        $user_id  = get_current_user_id();
        $replies  = get_post_meta( $pin_id, '_shanuman_va_replies', true ) ?: [];

        foreach ( $replies as $index => $reply ) {
            if ( isset( $reply['id'] ) && trim( $reply['id'] ) === $reply_id ) {
                $seen_by = isset( $reply['seen_by'] ) && is_array( $reply['seen_by'] ) ? $reply['seen_by'] : [];
                if ( ! in_array( $user_id, $seen_by, true ) ) {
                    $seen_by[]                    = $user_id;
                    $replies[ $index ]['seen_by'] = $seen_by;
                    update_post_meta( $pin_id, '_shanuman_va_replies', $replies );
                }
                break;
            }
        }
        return rest_ensure_response( [ 'success' => true ] );
    }

    public function delete_annotation( $request ) {
        $post_id = absint( $request->get_param( 'id' ) );
        wp_delete_post( $post_id, true );
        return rest_ensure_response( [ 'success' => true ] );
    }

    public function register_admin_menu() {
        add_menu_page(
            'Shanuman Annotations',
            'Annotations',
            'edit_posts',
            'shanuman-visual-annotations',
            [ $this, 'render_admin_dashboard_content' ],
            'dashicons-format-chat',
            30
        );
    }

    public function enqueue_admin_assets( $hook ) {
        if ( 'toplevel_page_shanuman-visual-annotations' !== $hook ) return;
        wp_enqueue_script( 'shanuman-va-admin-js', plugin_dir_url( __FILE__ ) . 'assets/js/admin-dashboard.js', [ 'wp-element', 'wp-components', 'wp-api-fetch' ], '1.0.2', true );

        $admin_config = apply_filters( 'shanuman_va_admin_config', [
            'restUrl'        => esc_url_raw( rest_url() ),
            'nonce'          => wp_create_nonce( 'wp_rest' ),
            'currentUserId'  => get_current_user_id(),
            'isAdmin'        => current_user_can( 'manage_options' ),
            'buttonColor'    => '#2271b1',
            'accentColor'    => '#46b450',
            'reopenColor'    => '#f56e28',
            'attentionColor' => '#d63638',
        ] );

        wp_localize_script( 'shanuman-va-admin-js', 'shanumanVaConfig', $admin_config );
        wp_enqueue_style( 'wp-components' );
    }

   /**
     * Enqueues frontend overlay scripts and dynamic configuration settings.
     */
    public function enqueue_frontend_assets() {
        $can_load = apply_filters( 'shanuman_va_can_load_frontend', current_user_can( 'edit_posts' ) );
        if ( ! $can_load ) {
            return;
        }
        if ( is_archive() || is_search() || is_home() ) {
            return;
        }

        // phpcs:disable WordPress.Security.NonceVerification.Recommended -- Read-only inspection of third-party page builder preview parameters.
        if (
            isset( $_GET['elementor-preview'] ) ||
            ( isset( $_GET['action'] ) && sanitize_text_field( wp_unslash( $_GET['action'] ) ) === 'elementor' ) ||
            isset( $_GET['et_fb'] ) ||
            isset( $_GET['fl_builder'] ) ||
            isset( $_GET['bricks'] ) ||
            isset( $_GET['ct_builder'] ) ||
            isset( $_GET['vcv-action'] ) ||
            isset( $_GET['siteorigin_panels_live_editor'] ) ||
            ( function_exists( 'is_customize_preview' ) && is_customize_preview() )
        ) {
            return;
        }
        // phpcs:enable WordPress.Security.NonceVerification.Recommended

        wp_enqueue_script( 'shanuman-va-frontend', plugin_dir_url( __FILE__ ) . 'assets/js/frontend-overlay.js', [], '1.0.2', true );

        $frontend_config = apply_filters( 'shanuman_va_frontend_config', [
            'restUrl'        => esc_url_raw( rest_url() ),
            'nonce'          => wp_create_nonce( 'wp_rest' ),
            'currentUserId'  => get_current_user_id(),
            'isAdmin'        => current_user_can( 'manage_options' ),
            'buttonColor'    => '#2271b1',
            'accentColor'    => '#46b450',
            'reopenColor'    => '#f56e28',
            'attentionColor' => '#d63638',
            'dimColor'       => '#000000',
            'dimOpacity'     => 0.7,
            'formWidth'      => 340,
        ] );

        wp_localize_script( 'shanuman-va-frontend', 'shanumanVaConfig', $frontend_config );
    }
}

Shanuman_Visual_Annotation::get_instance();