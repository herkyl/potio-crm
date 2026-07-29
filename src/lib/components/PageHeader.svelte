<script>
	// Top bar (title + actions) with an optional sub-nav strip beneath it.
	// SPEC §6.5. Pages supply `actions` and `subnav` as snippets.

	let { title, actions, subnav } = $props();
</script>

<header class="page-header">
	<div class="top">
		<h1>{title}</h1>
		{#if actions}
			<div class="actions">{@render actions()}</div>
		{/if}
	</div>

	{#if subnav}
		<div class="subnav">{@render subnav()}</div>
	{/if}
</header>

<style lang="less">
	.page-header {
		flex: none;
		border-bottom: 1px solid var(--border-subtle);
	}

	.top {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-6);
	}

	h1 {
		flex: 1;
		min-width: 0;
		font-size: var(--text-3xl);
		font-weight: var(--weight-bold);
		letter-spacing: -0.02em;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.subnav {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: 0 var(--space-6);
		min-width: 0;
	}
</style>
