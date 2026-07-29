<script>
	// One modal shell, used by both the candidate detail view and the prospect
	// card (SPEC §3.4). Sticky header, scrollable body, optional sticky footer.

	import Icon from './Icon.svelte';

	let { title = '', subtitle = '', width = 760, onclose, header, children, footer } = $props();

	let dialog = $state(null);

	function onkeydown(event) {
		if (event.key === 'Escape') {
			event.stopPropagation();
			onclose?.();
		}
	}

	// Focus the panel on open so Escape works and screen readers land inside.
	$effect(() => {
		dialog?.focus();
	});
</script>

<svelte:window {onkeydown} />

<div class="backdrop">
	<!-- Clicking the backdrop closes; the panel stops the click from reaching it. -->
	<div
		class="backdrop-hit"
		onclick={() => onclose?.()}
		role="presentation"
		aria-hidden="true"
	></div>

	<div
		class="panel"
		style:max-width="{width}px"
		bind:this={dialog}
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
	>
		<header>
			<div class="titles">
				{#if header}
					{@render header()}
				{:else}
					<h2>{title}</h2>
					{#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
				{/if}
			</div>
			<button class="close" onclick={() => onclose?.()} aria-label="Close">
				<Icon name="x" size={18} />
			</button>
		</header>

		<div class="body">
			{@render children()}
		</div>

		{#if footer}
			<footer>{@render footer()}</footer>
		{/if}
	</div>
</div>

<style lang="less">
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		place-items: center;
		padding: var(--space-5);
	}

	.backdrop-hit {
		position: absolute;
		inset: 0;
		background: rgba(16, 24, 40, 0.28);
		animation: fade var(--transition);
	}

	.panel {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-height: 88vh;
		background: var(--bg-app);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-modal);
		animation: rise 160ms ease;
		outline: none;
	}

	header {
		display: flex;
		align-items: flex-start;
		gap: var(--space-4);
		flex: none;
		padding: var(--space-5) var(--space-5) var(--space-4);
		border-bottom: 1px solid var(--border-subtle);
	}

	.titles {
		flex: 1;
		min-width: 0;
	}

	h2 {
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		letter-spacing: -0.01em;
	}

	.subtitle {
		margin-top: 2px;
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.close {
		display: grid;
		place-items: center;
		flex: none;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition:
			background var(--transition),
			color var(--transition);

		&:hover {
			background: var(--bg-column);
			color: var(--text-primary);
		}
	}

	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--space-5);
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-3);
		flex: none;
		padding: var(--space-4) var(--space-5);
		border-top: 1px solid var(--border-subtle);
		background: var(--bg-hover);
		border-radius: 0 0 var(--radius-xl) var(--radius-xl);
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
