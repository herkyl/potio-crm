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

	<!-- Width goes through a custom property rather than an inline `max-width` so
	     the mobile rule can drop it — an inline style would otherwise win. -->
	<div
		class="panel"
		style:--panel-max="{width}px"
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
		/* A centred grid item defaults to min-width:auto, so wide content could
		   push the panel past the viewport and cut off the close button. */
		min-width: 0;
		max-width: var(--panel-max);
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
		min-width: 0;
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

	/* Below this the panel takes the whole screen: a centred card with margins
	   wastes width that the content needs, and a short viewport makes the
	   scrollable body uncomfortably small. */
	@media (max-width: 720px) {
		.backdrop {
			padding: 0;
			/* Fill rather than centre — the panel is the whole screen here. */
			place-items: stretch;
		}

		.panel {
			max-width: none;
			height: 100%;
			max-height: none;
			border-radius: 0;
			/* Use the dynamic viewport unit so mobile browser chrome appearing or
			   hiding doesn't clip the footer. */
			height: 100dvh;
		}

		header {
			padding: var(--space-4) var(--space-4) var(--space-3);
		}

		.body {
			padding: var(--space-4);
		}

		footer {
			padding: var(--space-3) var(--space-4);
			border-radius: 0;
			/* Keep the primary action clear of the home indicator. */
			padding-bottom: max(var(--space-3), env(safe-area-inset-bottom));
		}

		h2 {
			font-size: var(--text-lg);
		}
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
