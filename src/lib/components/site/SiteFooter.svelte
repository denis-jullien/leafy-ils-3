<script lang="ts">
	import Logo from './Logo.svelte';
	import { SITE } from '$lib/content/site';
</script>

<footer class="site-footer">
	<div class="wrap footer-inner">
		<div class="footer-brand">
			<Logo size={36} />
			<div>
				<p class="brand-name">{SITE.name}</p>
				<p class="brand-sub">{SITE.footerTagline}</p>
			</div>
		</div>
		<p class="footer-note">{SITE.footerNote}</p>
	</div>
</footer>
