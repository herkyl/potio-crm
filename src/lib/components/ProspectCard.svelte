<script>
	// Card anatomy per SPEC §6.4: source tag bars along the top edge, the person's
	// name as the title, headline beneath, then a meta row with counts and the
	// stage age right-aligned. The card is a person, not a deal — no values.

	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import { avatarColor, shortAge, fullDate, truncate } from '$lib/format.js';
	import { isStale, staleAfter } from '$lib/stages.js';

	let { prospect, onopen } = $props();

	const sourceIds = $derived((prospect.source_ids ?? '').split(',').filter(Boolean));
	const stale = $derived(isStale(prospect.stage, prospect.stage_entered_at));
	const dueSoon = $derived(
		prospect.next_action_at && new Date(prospect.next_action_at) <= new Date()
	);
</script>

<article class="card" onclick={() => onopen?.(prospect.id)} role="presentation">
	<!-- One bar per source, so "found in 2 sources" reads at a glance. -->
	{#if sourceIds.length}
		<div class="bars">
			{#each sourceIds as sourceId}
				<span class="bar" style:background={avatarColor(sourceId)}></span>
			{/each}
		</div>
	{/if}

	<h3>{prospect.full_name}</h3>

	{#if prospect.headline || prospect.company}
		<p class="headline">{truncate(prospect.headline || prospect.company, 60)}</p>
	{/if}

	<div class="who">
		<Avatar name={prospect.full_name} id={prospect.person_id} size={20} />
		<span class="who-name">{prospect.company || prospect.location || 'No company'}</span>
	</div>

	{#if prospect.next_action}
		<p class="next-action" class:due={dueSoon}>
			<Icon name="clock" size={12} />
			{truncate(prospect.next_action, 40)}
			{#if prospect.next_action_at}<span class="when">{shortAge(prospect.next_action_at)}</span
				>{/if}
		</p>
	{/if}

	<footer class="meta">
		{#if prospect.note_count > 0}
			<span title="{prospect.note_count} notes"
				><Icon name="note" size={13} />{prospect.note_count}</span
			>
		{/if}
		{#if prospect.activity_count > 0}
			<span title="{prospect.activity_count} activities">
				<Icon name="activity" size={13} />{prospect.activity_count}
			</span>
		{/if}

		<!-- Stale rides in the meta row as a colour change, not a banner. -->
		<span
			class="age"
			class:stale
			title={stale
				? `${fullDate(prospect.stage_entered_at)} — over ${staleAfter(prospect.stage)} days in this stage`
				: fullDate(prospect.stage_entered_at)}
		>
			{#if stale}<span class="dot"></span>{/if}
			{shortAge(prospect.stage_entered_at)}
		</span>
	</footer>
</article>

<style lang="less">
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
		padding: var(--space-4);
		background: var(--bg-card);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-card);
		cursor: pointer;
		transition:
			box-shadow var(--transition),
			transform var(--transition);

		&:hover {
			box-shadow: var(--shadow-hover);
			transform: translateY(-1px);
		}
	}

	.bars {
		display: flex;
		gap: var(--space-1);
	}

	.bar {
		width: 28px;
		height: 3px;
		border-radius: var(--radius-pill);
	}

	h3 {
		font-size: var(--text-lg);
		font-weight: var(--weight-semi);
		letter-spacing: -0.01em;
		line-height: 1.25;
	}

	.headline {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.who {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}

	.who-name {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.next-action {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--bg-column);
		font-size: var(--text-xs);
		color: var(--text-secondary);

		&.due {
			background: var(--warn-soft);
			color: #92400e;
		}

		.when {
			margin-left: auto;
			font-variant-numeric: tabular-nums;
		}
	}

	.meta {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-1);
		font-size: var(--text-xs);
		color: var(--text-muted);

		span {
			display: inline-flex;
			align-items: center;
			gap: var(--space-1);
		}
	}

	.age {
		margin-left: auto;
		font-variant-numeric: tabular-nums;

		&.stale {
			color: var(--warn);
			font-weight: var(--weight-semi);
		}
	}

	.dot {
		width: 5px;
		height: 5px;
		border-radius: var(--radius-pill);
		background: var(--warn);
	}
</style>
