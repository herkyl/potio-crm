<script>
	// Classification labels and other small pills.
	let { tone = 'neutral', children } = $props();
</script>

<span class="badge {tone}">{@render children()}</span>

<style lang="less">
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 2px var(--space-2);
		border-radius: var(--radius-pill);
		font-size: var(--text-xs);
		font-weight: var(--weight-semi);
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.neutral {
		background: var(--bg-column);
		color: var(--text-secondary);
	}

	.prospect {
		background: var(--accent-soft);
		color: var(--accent-text);
	}

	.specialist {
		background: #eef2ff;
		color: #4338ca;
	}

	.unknown {
		background: #f5f5f4;
		color: var(--text-muted);
	}

	.warn {
		background: var(--warn-soft);
		color: #92400e;
	}

	.danger {
		background: var(--reject-soft);
		color: #991b1b;
	}
</style>
