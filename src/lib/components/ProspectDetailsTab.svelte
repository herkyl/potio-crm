<script>
	// Tab 1 of the card modal: who they are and where they are in the pipeline.
	//
	// Every field here is an InlineField, which autosaves on a pause in typing and
	// again on blur. There is no save button anywhere in this file — that
	// asymmetry between triage and the board was the thing that made the two
	// modals feel like different apps.
	//
	// A candidate that hasn't been accepted yet has no prospect row, so it has no
	// stage, no milestones and no timeline. Those sections are the only part of
	// the layout that varies by entry point.

	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import Badge from './Badge.svelte';
	import InlineField from './InlineField.svelte';
	import {
		STAGES,
		TERMINAL_STATUSES,
		DISQUALIFY_REASONS,
		stageLabel,
		statusLabel
	} from '$lib/stages.js';
	import { fullDate, ago } from '$lib/format.js';
	import { normaliseLinkedInSlug } from '$lib/linkedin.js';

	let { subject, fields, save, mutate } = $props();

	const prospect = $derived(subject.prospect);

	let closing = $state(false);
	let closeStatus = $state(null);
	let closeReason = $state('');
	let noteBody = $state('');
	let posting = $state(false);

	// Spelled out in the UI because the lost/disqualified distinction is the whole
	// point of having both, and it's easy to reach for the wrong one.
	const CLOSE_MEANING = {
		won: 'They became a customer.',
		lost: 'We engaged and it did not work out. Counts as funnel drop-off.',
		parked: 'Still interesting, wrong time. The icebox.',
		disqualified:
			'Should not have been accepted, or cannot be worked. Kept on record, excluded from funnel stats.'
	};

	const MILESTONES = [
		['Shortlisted', 'shortlisted_at'],
		['Invite sent', 'invite_sent_at'],
		['Connected', 'connected_at'],
		['First message', 'first_message_at'],
		['First reply', 'first_reply_at'],
		['Opportunity', 'opportunity_at'],
		['Closed', 'closed_at']
	];

	const ACTIVITY_ICON = {
		stage_change: 'arrowRight',
		status_change: 'check',
		note: 'note',
		accepted: 'check',
		field_edit: 'edit',
		draft_generated: 'edit'
	};

	function activityText(activity) {
		if (activity.type === 'stage_change') {
			return `${stageLabel(activity.from_stage)} → ${stageLabel(activity.to_stage)}`;
		}
		return activity.body || activity.type.replace(/_/g, ' ');
	}

	async function addNote() {
		const body = noteBody.trim();
		if (!body) return;
		posting = true;
		const ok = await mutate('note', { body });
		posting = false;
		if (ok) noteBody = '';
	}

	async function close() {
		if (!closeStatus) return;
		const ok = await mutate('status', { status: closeStatus, reason: closeReason });
		if (ok) {
			closing = false;
			closeStatus = null;
			closeReason = '';
		}
	}

	const dateOnly = (iso) => (iso ?? '').slice(0, 10);
</script>

<section>
	<h3>Identity</h3>
	<div class="grid">
		<InlineField label="Name" name="full_name" value={fields.full_name} onsave={save} />
		<InlineField label="Company" name="company" value={fields.company} onsave={save} />
		<InlineField label="Headline" name="headline" value={fields.headline} multiline onsave={save} />
		<InlineField label="Location" name="location" value={fields.location} onsave={save} />

		<div class="linkedin">
			<InlineField
				label="LinkedIn URL"
				name="linkedin_url"
				value={fields.linkedin_url}
				placeholder="Not set — paste a profile URL"
				onsave={save}
				hint={slugHint}
			/>
			{#if fields.linkedin_url}
				<a
					href={fields.linkedin_url}
					target="_blank"
					rel="noreferrer noopener"
					title="Open profile"
				>
					<Icon name="link" size={14} />
				</a>
			{/if}
		</div>

		<InlineField label="Website" name="website_url" value={fields.website_url} onsave={save} />
	</div>
</section>

{#if prospect}
	<section>
		<h3>Pipeline</h3>
		<div class="controls">
			<label class="stage-picker">
				<span>Stage</span>
				<select value={prospect.stage} onchange={(e) => save('stage', e.currentTarget.value)}>
					{#each STAGES as stage}
						<option value={stage.id}>{stage.label}</option>
					{/each}
				</select>
			</label>

			<InlineField
				label="Next action"
				name="next_action"
				value={fields.next_action}
				placeholder="e.g. Send invite"
				onsave={save}
			/>
			<InlineField
				label="Due"
				name="next_action_at"
				type="date"
				value={dateOnly(fields.next_action_at)}
				placeholder="No date"
				format={(v) => (v ? new Date(v).toLocaleDateString('en-GB') : '')}
				onsave={save}
			/>
		</div>

		<dl class="milestones">
			{#each MILESTONES as [label, field]}
				{#if prospect[field]}
					<div>
						<dt>{label}</dt>
						<dd title={fullDate(prospect[field])}>{ago(prospect[field])}</dd>
					</div>
				{/if}
			{/each}
		</dl>
	</section>

	<section>
		<h3>Add a note</h3>
		<div class="note-form">
			<textarea rows="2" bind:value={noteBody} placeholder="What happened?"></textarea>
			<Button size="sm" onclick={addNote} disabled={posting || !noteBody.trim()}>Add note</Button>
		</div>
	</section>

	<section>
		<h3>Timeline ({subject.activities.length})</h3>
		<ol class="timeline">
			{#each subject.activities as activity (activity.id)}
				<li>
					<span class="dot">
						<Icon name={ACTIVITY_ICON[activity.type] ?? 'activity'} size={12} />
					</span>
					<div class="entry">
						<p class:note={activity.type === 'note'}>{activityText(activity)}</p>
						<span class="when" title={fullDate(activity.occurred_at)}>
							{ago(activity.occurred_at)}
						</span>
					</div>
				</li>
			{/each}
		</ol>
	</section>

	<section>
		<h3>Close</h3>
		{#if prospect.status === 'open'}
			{#if closing}
				<div class="close-form">
					<!-- Pick the outcome first, so the reason field can offer presets
					     that actually match it. -->
					<div class="close-buttons">
						{#each TERMINAL_STATUSES as terminal}
							<button
								type="button"
								class="outcome {terminal.id}"
								class:chosen={closeStatus === terminal.id}
								aria-pressed={closeStatus === terminal.id}
								onclick={() => (closeStatus = terminal.id)}
							>
								<Icon name={terminal.icon} size={14} />
								{terminal.label}
							</button>
						{/each}
					</div>

					{#if closeStatus}
						<p class="close-meaning">{CLOSE_MEANING[closeStatus]}</p>

						{#if closeStatus === 'disqualified'}
							<div class="presets">
								{#each DISQUALIFY_REASONS as preset}
									<button
										type="button"
										class="preset"
										class:chosen={closeReason === preset}
										onclick={() => (closeReason = preset)}
									>
										{preset}
									</button>
								{/each}
							</div>
						{/if}

						<input
							bind:value={closeReason}
							placeholder={closeStatus === 'disqualified'
								? 'Reason — pick one above or type your own'
								: 'Reason (optional)'}
						/>
					{/if}

					<div class="close-buttons">
						<Button
							size="sm"
							variant={closeStatus === 'disqualified' ? 'danger' : 'primary'}
							onclick={close}
							disabled={!closeStatus}
						>
							{closeStatus ? `Close as ${statusLabel(closeStatus)}` : 'Pick an outcome'}
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onclick={() => {
								closing = false;
								closeStatus = null;
								closeReason = '';
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			{:else}
				<Button size="sm" onclick={() => (closing = true)}>Close this prospect…</Button>
			{/if}
		{:else}
			<div class="closed">
				<p>
					<strong>{statusLabel(prospect.status)}</strong>
					in {stageLabel(prospect.stage)}
					{#if prospect.closed_at}· {fullDate(prospect.closed_at)}{/if}
				</p>
				{#if prospect.close_reason}<p class="dim">{prospect.close_reason}</p>{/if}
				<Button size="sm" icon="undo" onclick={() => mutate('status', { status: 'open' })}>
					Reopen
				</Button>
			</div>
		{/if}
	</section>
{:else}
	<!-- A candidate has no card yet, so there is no stage to set and no timeline
	     to show. Everything above is still editable, and the edits survive
	     whether or not it's accepted. -->
	<section>
		<h3>Pipeline</h3>
		<p class="pending">
			<Badge tone="neutral">{subject.status ?? 'new'}</Badge>
			{#if subject.status === 'accepted'}
				Already on the board — stage, timeline and notes live on the card.
			{:else if subject.status === 'rejected'}
				Rejected. Accepting from the footer promotes it normally.
			{:else}
				Not on the board yet. Accept it to give it a stage and a timeline.
			{/if}
		</p>
	</section>
{/if}

{#snippet slugHint(draft)}
	{@const slug = normaliseLinkedInSlug(draft)}
	{#if draft && slug}
		Will save as {slug}
	{:else if draft}
		Not a recognisable profile URL
	{/if}
{/snippet}

<style lang="less">
	section + section {
		margin-top: var(--space-5);
		padding-top: var(--space-5);
		border-top: 1px solid var(--border-subtle);
	}

	h3 {
		margin-bottom: var(--space-3);
		font-size: var(--text-xs);
		font-weight: var(--weight-semi);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.grid {
		display: grid;
		/* minmax(0, …) rather than plain 1fr: a track's default minimum is
		   min-content, which a long LinkedIn URL pushes past the viewport. */
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3) var(--space-5);
	}

	.linkedin {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);

		> :global(.field) {
			flex: 1;
			min-width: 0;
		}

		a {
			padding-bottom: var(--space-2);
			color: var(--accent-text);
		}
	}

	.controls {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-items: end;
		gap: var(--space-3) var(--space-5);
	}

	.stage-picker {
		display: flex;
		flex-direction: column;
		gap: 2px;

		> span {
			font-size: var(--text-xs);
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--text-muted);
		}
	}

	select,
	input,
	textarea {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border-input);
		border-radius: var(--radius-md);
		background: #ffffff;
		font-size: var(--text-base);
		resize: vertical;

		&:focus {
			outline: none;
			border-color: var(--accent);
		}
	}

	.milestones {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		margin: var(--space-4) 0 0;

		dt {
			font-size: var(--text-xs);
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--text-muted);
		}

		dd {
			margin: 0;
			font-size: var(--text-sm);
			font-weight: var(--weight-medium);
		}
	}

	.note-form {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);

		textarea {
			flex: 1;
		}
	}

	.timeline {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);

		li {
			display: flex;
			align-items: flex-start;
			gap: var(--space-3);
		}
	}

	.dot {
		display: grid;
		place-items: center;
		flex: none;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-pill);
		background: var(--bg-column);
		color: var(--text-muted);
	}

	.entry {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		flex: 1;
		min-width: 0;
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border-subtle);

		p {
			flex: 1;
			min-width: 0;
			font-size: var(--text-sm);

			&.note {
				white-space: pre-wrap;
				color: var(--text-primary);
			}
		}
	}

	.when {
		font-size: var(--text-xs);
		color: var(--text-muted);
		white-space: nowrap;
	}

	.close-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 420px;
	}

	.close-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.outcome {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		min-height: 30px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: #ffffff;
		font-size: var(--text-sm);
		font-weight: var(--weight-semi);
		color: var(--text-secondary);
		transition:
			background var(--transition),
			border-color var(--transition),
			color var(--transition);

		&:hover {
			background: var(--bg-hover);
			color: var(--text-primary);
		}

		&.chosen {
			color: var(--text-primary);
			border-color: transparent;
		}

		&.won.chosen {
			background: var(--bg-column-won);
			color: var(--accent-text);
		}

		&.lost.chosen {
			background: var(--reject-soft);
			color: #991b1b;
		}

		&.parked.chosen {
			background: var(--bg-column-parked);
			color: #92400e;
		}

		/* Cooler than lost — never in play, rather than didn't convert. */
		&.disqualified.chosen {
			background: var(--bg-column-disqualified);
			color: #475569;
		}
	}

	.close-meaning {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.preset {
		padding: 2px var(--space-3);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-pill);
		background: #ffffff;
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);
		transition:
			background var(--transition),
			color var(--transition);

		&:hover {
			background: var(--bg-hover);
			color: var(--text-primary);
		}

		&.chosen {
			background: var(--bg-column-disqualified);
			border-color: transparent;
			color: #475569;
		}
	}

	.closed {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		align-items: flex-start;

		strong {
			text-transform: capitalize;
		}
	}

	.pending {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.dim {
		color: var(--text-muted);
	}

	/* --- Mobile ------------------------------------------------------------
	   Kept last so these override the desktop rules above. --- */

	@media (max-width: 720px) {
		.grid,
		.controls {
			grid-template-columns: minmax(0, 1fr);
		}

		select,
		input,
		textarea {
			width: 100%;
			/* 16px stops iOS Safari zooming the viewport on focus. */
			font-size: 16px;
		}

		.note-form {
			flex-direction: column;
			align-items: stretch;
		}

		.milestones {
			gap: var(--space-3);
		}

		.close-form {
			max-width: none;
		}
	}
</style>
