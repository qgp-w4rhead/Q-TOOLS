<?php
/**
 * Plugin Name:       Q-Tools Embed
 * Plugin URI:        https://github.com/cognition-ai/q-tools
 * Description:       Embed any Q-Tools developer utility in WordPress posts and pages via the [q_tools] shortcode. Requires a deployed Q-Tools instance (the iframe origin).
 * Version:           1.0.0
 * Requires at least: 5.5
 * Requires PHP:      7.4
 * Author:            Q-Tools
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 *
 * @package Q_Tools_Embed
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

/**
 * Default Q-Tools origin (override via Settings → Q-Tools Embed or the
 * QTOOLS_BASE_URL constant in wp-config.php).
 */
if ( ! defined( 'QTOOLS_DEFAULT_BASE' ) ) {
	define( 'QTOOLS_DEFAULT_BASE', 'https://q-tools.example.com' );
}

/**
 * Retrieve the configured Q-Tools base URL.
 *
 * Priority: QTOOLS_BASE_URL constant > option `qtools_base_url` > default.
 *
 * @return string Base URL without trailing slash.
 */
function qtools_get_base_url() {
	if ( defined( 'QTOOLS_BASE_URL' ) && QTOOLS_BASE_URL ) {
		return rtrim( QTOOLS_BASE_URL, '/' );
	}
	$option = get_option( 'qtools_base_url', QTOOLS_DEFAULT_BASE );
	return rtrim( $option, '/' );
}

/**
 * Enqueue the embed.js loader from the Q-Tools origin.
 *
 * The script is enqueued with a `data-qtools-base` attribute so embed.js
 * resolves the iframe origin correctly even when the script is served from
 * a CDN or a different path.
 */
function qtools_enqueue_embed_script() {
	static $enqueued = false;
	if ( $enqueued ) {
		return;
	}
	$enqueued = true;

	$base   = qtools_get_base_url();
	$src    = $base . '/embed.js';
	$handle = 'qtools-embed';

	// Register + enqueue with the base URL as a data attribute.
	wp_register_script( $handle, $src, array(), '1.0.0', true );
	wp_enqueue_script( $handle );
	wp_add_inline_script(
		$handle,
		'/* Q-Tools embed base: ' . esc_js( $base ) . ' */',
		'before'
	);
}

/**
 * Shortcode handler: [q_tools tool="hash-text"]
 *
 * Supported attributes:
 *   tool    (required) Tool slug, e.g. "hash-text".
 *   input   (optional) JSON-encoded initial input payload.
 *   width   (optional) iframe width (default "100%").
 *   height  (optional) iframe height (default "auto").
 *   allow   (optional) iframe `allow` attribute (Permissions Policy).
 *   lang    (optional) UI locale for the embedded tool: en, es, or fr.
 *   target  (optional) CSS selector for a custom mount element.
 *
 * @param array $atts Shortcode attributes.
 * @return string HTML markup (a container div + declarative script tag).
 */
function qtools_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'tool'   => '',
			'input'  => '',
			'width'  => '100%',
			'height' => 'auto',
			'allow'  => '',
			'lang'   => '',
			'target' => '',
		),
		$atts,
		'q_tools'
	);

	$slug = sanitize_key( $atts['tool'] );
	if ( '' === $slug ) {
		return '<p class="qtools-error"><strong>Q-Tools:</strong> ' .
			esc_html__( 'Missing required "tool" attribute.', 'q-tools-embed' ) . '</p>';
	}

	// Enqueue the loader script.
	qtools_enqueue_embed_script();

	// Build the declarative <script data-tool="..."> tag that embed.js
	// auto-discovers on DOMContentLoaded. We render a unique container so
	// multiple shortcodes on the same page don't collide.
	$container_id = 'qtools-' . $slug . '-' . wp_generate_password( 6, false );

	$script_attrs = array(
		'data-tool'   => $slug,
		'data-target' => '#' . $container_id,
	);
	if ( '' !== $atts['width'] ) {
		$script_attrs['data-width'] = $atts['width'];
	}
	if ( '' !== $atts['height'] ) {
		$script_attrs['data-height'] = $atts['height'];
	}
	if ( '' !== $atts['allow'] ) {
		$script_attrs['data-allow'] = $atts['allow'];
	}
	if ( '' !== $atts['lang'] ) {
		// Only allow supported locale codes; embed.js maps this to ?lang=.
		$lang = sanitize_key( $atts['lang'] );
		if ( in_array( $lang, array( 'en', 'es', 'fr' ), true ) ) {
			$script_attrs['data-locale'] = $lang;
		}
	}
	if ( '' !== $atts['input'] ) {
		// Validate JSON before emitting to avoid breaking the page.
		$decoded = json_decode( $atts['input'], true );
		if ( null !== $decoded ) {
			$script_attrs['data-input'] = wp_json_encode( $decoded );
		}
	}

	// Build the script tag with escaped attributes.
	$base       = qtools_get_base_url();
	$script_url = $base . '/embed.js';
	$script_src = esc_url( $script_url );
	$script     = '<script src="' . $script_src . '" async';
	foreach ( $script_attrs as $key => $value ) {
		$script .= ' ' . $key . '="' . esc_attr( $value ) . '"';
	}
	$script .= '></script>';

	$container_style = sprintf(
		'width:%s;min-height:%s;',
		esc_attr( $atts['width'] ),
		'auto' === $atts['height'] ? '80px' : esc_attr( $atts['height'] )
	);

	$markup  = '<div class="qtools-embed-wrap" id="' . esc_attr( $container_id ) . '" style="' . $container_style . '"></div>';
	$markup .= $script;

	return $markup;
}
add_shortcode( 'q_tools', 'qtools_shortcode' );

/* ------------------------------------------------------------------ */
/* Settings page (Settings → Q-Tools Embed)                            */
/* ------------------------------------------------------------------ */

/**
 * Register the `qtools_base_url` option.
 */
function qtools_settings_init() {
	register_setting(
		'qtools_settings_group',
		'qtools_base_url',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'qtools_sanitize_base_url',
			'default'           => QTOOLS_DEFAULT_BASE,
		)
	);
}
add_action( 'admin_init', 'qtools_settings_init' );

/**
 * Sanitize the base URL option.
 *
 * @param string $value Raw input.
 * @return string Sanitized URL without trailing slash.
 */
function qtools_sanitize_base_url( $value ) {
	$value = trim( (string) $value );
	if ( '' === $value ) {
		return QTOOLS_DEFAULT_BASE;
	}
	// Ensure it has a scheme.
	if ( ! preg_match( '#^https?://#i', $value ) ) {
		$value = 'https://' . $value;
	}
	return rtrim( esc_url_raw( $value ), '/' );
}

/**
 * Add the settings sub-menu page.
 */
function qtools_settings_menu() {
	add_options_page(
		__( 'Q-Tools Embed', 'q-tools-embed' ),
		__( 'Q-Tools Embed', 'q-tools-embed' ),
		'manage_options',
		'qtools-embed',
		'qtools_settings_page'
	);
}
add_action( 'admin_menu', 'qtools_settings_menu' );

/**
 * Render the settings page.
 */
function qtools_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
		<p><?php esc_html_e( 'Configure the Q-Tools instance that the [q_tools] shortcode embeds.', 'q-tools-embed' ); ?></p>
		<form action="options.php" method="post">
			<?php
			settings_fields( 'qtools_settings_group' );
			?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">
						<label for="qtools_base_url"><?php esc_html_e( 'Q-Tools Base URL', 'q-tools-embed' ); ?></label>
					</th>
					<td>
						<input
							type="url"
							id="qtools_base_url"
							name="qtools_base_url"
							value="<?php echo esc_attr( get_option( 'qtools_base_url', QTOOLS_DEFAULT_BASE ) ); ?>"
							class="regular-text"
							placeholder="https://q-tools.example.com"
						/>
						<p class="description">
							<?php esc_html_e( 'The origin of your deployed Q-Tools instance (no trailing slash). embed.js and the iframe src are resolved against this URL.', 'q-tools-embed' ); ?>
						</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<h2><?php esc_html_e( 'Usage', 'q-tools-embed' ); ?></h2>
		<p><?php esc_html_e( 'Add the shortcode to any post or page:', 'q-tools-embed' ); ?></p>
		<pre><code>[q_tools tool="hash-text"]</code></pre>
		<p><?php esc_html_e( 'With initial input and custom size:', 'q-tools-embed' ); ?></p>
		<pre><code>[q_tools tool="hash-text" input='{"text":"hello"}' width="100%" height="auto"]</code></pre>
		<p><?php esc_html_e( 'Tools that need special permissions (camera, clipboard) auto-apply the correct iframe `allow` attribute. Override with the allow attribute if needed:', 'q-tools-embed' ); ?></p>
		<pre><code>[q_tools tool="camera-recorder" allow="camera; microphone"]</code></pre>
	</div>
	<?php
}

/* ------------------------------------------------------------------ */
/* Activation / deactivation                                           */
/* ------------------------------------------------------------------ */

/**
 * On activation, seed the default base URL option.
 */
function qtools_activate() {
	if ( false === get_option( 'qtools_base_url' ) ) {
		add_option( 'qtools_base_url', QTOOLS_DEFAULT_BASE );
	}
}
register_activation_hook( __FILE__, 'qtools_activate' );
