<script lang="ts">
	/* Brand block for the sign-in pages: logo, name and the "Espace bénévoles" tag. */
	import Logo from '$lib/components/site/Logo.svelte';
	import { LIBRARY_NAME } from '$lib/config';
</script>

<div class="mb-6 flex flex-col items-center gap-3 text-center">
	<Logo size={64} />
	<div>
		<div class="desk-brand-name mx-auto" style:max-width="none">{LIBRARY_NAME}</div>
		<span class="desk-tag mt-1">Espace bénévoles</span>
	</div>
</div>
