<script>
	import { percent } from '$lib/format.js';

	let { value = null, width = 44 } = $props();
</script>

{#if value === null || value === undefined}
	<span class="none">—</span>
{:else}
	<span class="wrap" title="Confidence {percent(value)}">
		<span class="track" style:width="{width}px">
			<span class="fill" class:low={value < 0.6} style:width="{Math.round(value * 100)}%"></span>
		</span>
		<span class="value">{percent(value)}</span>
	</span>
{/if}

<style lang="less">
	.wrap {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.track {
		height: 4px;
		border-radius: var(--radius-pill);
		background: var(--border-subtle);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: var(--radius-pill);
		background: var(--accent);

		&.low {
			background: var(--warn);
		}
	}

	.value {
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
		color: var(--text-secondary);
	}

	.none {
		color: var(--text-muted);
	}
</style>
