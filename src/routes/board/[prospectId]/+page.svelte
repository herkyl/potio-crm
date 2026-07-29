<script>
	// The prospect card modal, rendered over the board. SPEC §3.4.

	import { enhance, deserialize } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import ConfidenceBar from '$lib/components/ConfidenceBar.svelte';
	import InlineField from '$lib/components/InlineField.svelte';
	import {
		STAGES,
		TERMINAL_STATUSES,
		DISQUALIFY_REASONS,
		stageLabel,
		statusLabel,
		isStale,
		staleAfter
	} from '$lib/stages.js';
	import { parseJson, fullDate, shortAge, ago, daysBetween, truncate } from '$lib/format.js';
	import { normaliseLinkedInSlug } from '$lib/linkedin.js';

	let { data, form } = $props();

	let saveError = $state(null);
	let closing = $state(false);
	let closeStatus = $state(null);
	let closeReason = $state('');
	let noteBody = $state('');

	// Spelled out in the UI because the lost/disqualified distinction is the whole
	// point of having both, and it's easy to reach for the wrong one.
	const CLOSE_MEANING = {
		won: 'They became a customer.',
		lost: 'We engaged and it did not work out. Counts as funnel drop-off.',
		parked: 'Still interesting, wrong time. The icebox.',
		disqualified:
			'Should not have been accepted, or cannot be worked. Kept on record, excluded from funnel stats.'
	};

	// Inline edits report through `saveError`; the form actions report through
	// `form`. One banner shows whichever happened.
	const errorMessage = $derived(saveError ?? form?.error ?? null);

	// Locally applied edits, layered over the server's copy. This is what makes a
	// field edit feel instant: the input reflects the change immediately and the
	// request settles in the background.
	let edits = $state({});
	let saving = $state(0);
	// The board underneath shows name/headline/company, so it needs refreshing —
	// but only once, when the modal closes, not after every keystroke.
	let boardDirty = $state(false);

	const p = $derived({ ...data.prospect, ...edits });
	const stale = $derived(p.status === 'open' && isStale(p.stage, p.stage_entered_at));
	const daysInStage = $derived(daysBetween(p.stage_entered_at));

	// A fresh server payload supersedes the optimistic overlay.
	$effect(() => {
		data.prospect;
		edits = {};
	});

	async function close() {
		if (boardDirty) await invalidate('crm:board');
		goto('/board');
	}

	/**
	 * Inline edits post to the same action a full form would, but never call
	 * `invalidateAll()`. That used to re-run every load function on the page —
	 * seven queries, ~1.2s — for a one-column update that already succeeded.
	 */
	async function savePerson(field, value) {
		saveError = null;
		const previous = p[field];
		edits = { ...edits, [field]: value }; // optimistic
		saving++;

		try {
			const body = new FormData();
			body.set('personId', p.person_id);
			body.set(field, value);

			const response = await fetch('?/updatePerson', { method: 'POST', body });
			const result = deserialize(await response.text());

			const message =
				result.type === 'error'
					? (result.error?.message ?? 'Save failed')
					: (result.data?.error ?? null);

			if (message) {
				// Roll the field back so the UI never claims a save that didn't happen.
				edits = { ...edits, [field]: previous };
				saveError = message;
				return;
			}

			boardDirty = true;
		} catch (err) {
			edits = { ...edits, [field]: previous };
			saveError = err.message ?? 'Save failed';
		} finally {
			saving--;
		}
	}

	/**
	 * Refresh only what a given mutation actually changed, instead of everything.
	 *  - prospect: this modal's own data (timeline, milestones)
	 *  - board:    the columns underneath (stage, card face, worklist stats)
	 *  - counts:   the sidebar badges, which only a status change moves
	 */
	const refresh = (...keys) => Promise.all(keys.map((key) => invalidate(key)));

	const afterEdit =
		() =>
		async ({ update }) => {
			await update({ invalidateAll: false });
			await refresh('crm:prospect');
			boardDirty = true;
		};

	const afterStageChange =
		() =>
		async ({ update }) => {
			await update({ invalidateAll: false });
			await refresh('crm:prospect', 'crm:board');
		};

	const afterStatusChange =
		() =>
		async ({ update }) => {
			await update({ invalidateAll: false });
			await refresh('crm:prospect', 'crm:board', 'crm:counts');
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

	const labelTone = (label) =>
		({ PROSPECT: 'prospect', SPECIALIST: 'specialist', UNKNOWN: 'unknown' })[label] ?? 'neutral';
</script>

<Modal onclose={close} width={860} title={p.full_name}>
	{#snippet header()}
		<div class="head">
			<Avatar name={p.full_name} id={p.person_id} size={44} />
			<div class="head-text">
				<h2>{p.full_name}</h2>
				<p class="sub">{p.headline || p.company || 'No headline'}</p>
			</div>
			<div class="head-state">
				<!-- Saves are optimistic now, so the only cue that one is in flight is
				     this. Absence of it means everything has landed. -->
				{#if saving > 0}<span class="saving">Saving…</span>{/if}
				<Badge tone={p.status === 'open' ? 'prospect' : 'neutral'}>
					{p.status === 'open' ? stageLabel(p.stage) : statusLabel(p.status)}
				</Badge>
				<span class="age" class:stale>
					{daysInStage}d in {stageLabel(p.stage)}
					{#if stale}· over {staleAfter(p.stage)}d{/if}
				</span>
			</div>
		</div>
	{/snippet}

	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}

	<!-- 1. Identity -->
	<section>
		<h3>Identity</h3>
		<div class="grid">
			<InlineField label="Name" name="full_name" value={p.full_name} onsave={savePerson} />
			<InlineField label="Company" name="company" value={p.company} onsave={savePerson} />
			<InlineField
				label="Headline"
				name="headline"
				value={p.headline}
				multiline
				onsave={savePerson}
			/>
			<InlineField label="Location" name="location" value={p.location} onsave={savePerson} />

			<div class="linkedin">
				<InlineField
					label="LinkedIn URL"
					name="linkedin_url"
					value={p.linkedin_url}
					placeholder="Not set — paste a profile URL"
					onsave={savePerson}
					hint={slugHint}
				/>
				{#if p.linkedin_url}
					<a href={p.linkedin_url} target="_blank" rel="noreferrer noopener" title="Open profile">
						<Icon name="link" size={14} />
					</a>
				{/if}
			</div>

			<InlineField label="Website" name="website_url" value={p.website_url} onsave={savePerson} />
		</div>

		<div class="controls">
			<form method="POST" action="?/stage" use:enhance={afterStageChange}>
				<label>
					<span>Stage</span>
					<select
						name="stage"
						value={p.stage}
						onchange={(e) => e.currentTarget.form.requestSubmit()}
					>
						{#each STAGES as stage}
							<option value={stage.id}>{stage.label}</option>
						{/each}
					</select>
				</label>
			</form>

			<form method="POST" action="?/nextAction" use:enhance={afterEdit} class="next-action">
				<label>
					<span>Next action</span>
					<input name="next_action" value={p.next_action ?? ''} placeholder="e.g. Send invite" />
				</label>
				<label>
					<span>Due</span>
					<input type="date" name="next_action_at" value={(p.next_action_at ?? '').slice(0, 10)} />
				</label>
				<Button size="sm" type="submit">Save</Button>
			</form>
		</div>

		<dl class="milestones">
			{#each MILESTONES as [label, field]}
				{#if p[field]}
					<div>
						<dt>{label}</dt>
						<dd title={fullDate(p[field])}>{ago(p[field])}</dd>
					</div>
				{/if}
			{/each}
		</dl>
	</section>

	<!-- 2. Provenance — seeing why the AI flagged someone is what makes it trustworthy. -->
	<section>
		<h3>Provenance ({data.provenance.length})</h3>
		{#if data.provenance.length === 0}
			<p class="dim">Added manually. No source.</p>
		{:else}
			<ul class="provenance">
				{#each data.provenance as row}
					<li>
						<header>
							<strong>{row.source_name}</strong>
							<Badge tone={labelTone(row.label)}>{row.label ?? 'unclassified'}</Badge>
							<ConfidenceBar value={row.confidence} />
							<span class="when" title={fullDate(row.found_at)}>found {ago(row.found_at)}</span>
						</header>
						{#if row.reasoning}<p class="reason">{row.reasoning}</p>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- 3. Source context -->
	{#each data.provenance as row}
		{@const evidence = parseJson(row.evidence_json, null)}
		{#if evidence}
			<section>
				<h3>Flagging post — {row.source_name}</h3>
				<article class="post">
					<h4>{evidence.title || 'Untitled post'}</h4>
					{#if evidence.body}<p class="body">{evidence.body}</p>{/if}
					<footer>
						{#if evidence.posted_at}<span>{fullDate(evidence.posted_at)}</span>{/if}
						{#if evidence.url}
							<a href={evidence.url} target="_blank" rel="noreferrer noopener">
								Open in Skool <Icon name="link" size={13} />
							</a>
						{/if}
					</footer>
				</article>
			</section>
		{/if}
	{/each}

	{#if data.posts.length}
		<section>
			<h3>Their posts ({data.posts.length})</h3>
			<ul class="posts">
				{#each data.posts as post}
					<li>
						<span class="post-title">{post.title || 'Untitled'}</span>
						{#if post.is_help_request}<Badge tone="warn">help request</Badge>{/if}
						<span class="when">{shortAge(post.posted_at)}</span>
						{#if post.url}
							<a href={post.url} target="_blank" rel="noreferrer noopener" aria-label="Open post">
								<Icon name="link" size={13} />
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- 6. Notes, appended into the same timeline -->
	<section>
		<h3>Add a note</h3>
		<form
			method="POST"
			action="?/note"
			use:enhance={() =>
				async ({ update }) => {
					// Only the timeline changes here; the board just needs the note
					// count refreshed, which happens once on close.
					await update({ invalidateAll: false });
					await refresh('crm:prospect');
					boardDirty = true;
					noteBody = '';
				}}
			class="note-form"
		>
			<textarea name="body" rows="2" bind:value={noteBody} placeholder="What happened?"></textarea>
			<Button size="sm" type="submit" disabled={!noteBody.trim()}>Add note</Button>
		</form>
	</section>

	<!-- 4. Timeline -->
	<section>
		<h3>Timeline ({data.activities.length})</h3>
		<ol class="timeline">
			{#each data.activities as activity}
				<li>
					<span class="dot"
						><Icon name={ACTIVITY_ICON[activity.type] ?? 'activity'} size={12} /></span
					>
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

	<!-- 7. Close -->
	<section>
		<h3>Close</h3>
		{#if p.status === 'open'}
			{#if closing}
				<form method="POST" action="?/status" use:enhance={afterStatusChange} class="close-form">
					<input type="hidden" name="status" value={closeStatus ?? ''} />

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
							name="reason"
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
							type="submit"
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
				</form>
			{:else}
				<Button size="sm" onclick={() => (closing = true)}>Close this prospect…</Button>
			{/if}
		{:else}
			<div class="closed">
				<p>
					<strong>{statusLabel(p.status)}</strong>
					in {stageLabel(p.stage)}
					{#if p.closed_at}· {fullDate(p.closed_at)}{/if}
				</p>
				{#if p.close_reason}<p class="dim">{p.close_reason}</p>{/if}
				<form method="POST" action="?/status" use:enhance={afterStatusChange}>
					<input type="hidden" name="status" value="open" />
					<Button size="sm" type="submit" icon="undo">Reopen</Button>
				</form>
			</div>
		{/if}
	</section>

	{#snippet footer()}
		<span class="footer-note">
			{#if p.linkedin_url}
				Send the invite in LinkedIn yourself, then move the card.
			{:else}
				No LinkedIn URL yet — add one above.
			{/if}
		</span>
		<Button onclick={close}>Done</Button>
	{/snippet}
</Modal>

{#snippet slugHint(draft)}
	{@const slug = normaliseLinkedInSlug(draft)}
	{#if draft && slug}
		Will save as {slug}
	{:else if draft}
		Not a recognisable profile URL
	{/if}
{/snippet}

<style lang="less">
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
	}

	.head-text {
		flex: 1;
		min-width: 0;
	}

	h2 {
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		letter-spacing: -0.01em;
	}

	.sub {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.head-state {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-1);
		flex: none;
	}

	.age {
		font-size: var(--text-xs);
		color: var(--text-muted);

		&.stale {
			color: var(--warn);
			font-weight: var(--weight-semi);
		}
	}

	.saving {
		font-size: var(--text-xs);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

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
		grid-template-columns: 1fr 1fr;
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
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-4);
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px dashed var(--border-subtle);
	}

	.next-action {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
	}

	label {
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

	.provenance li {
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--bg-column);

		& + li {
			margin-top: var(--space-2);
		}

		header {
			display: flex;
			align-items: center;
			gap: var(--space-3);
			flex-wrap: wrap;
		}
	}

	.reason {
		margin-top: var(--space-2);
		font-size: var(--text-sm);
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.when {
		margin-left: auto;
		font-size: var(--text-xs);
		color: var(--text-muted);
		white-space: nowrap;
	}

	.post {
		padding: var(--space-4);
		border-radius: var(--radius-md);
		background: var(--bg-column);

		h4 {
			font-size: var(--text-lg);
			font-weight: var(--weight-semi);
			margin-bottom: var(--space-2);
		}

		.body {
			white-space: pre-wrap;
			line-height: 1.55;
		}

		footer {
			display: flex;
			gap: var(--space-4);
			margin-top: var(--space-3);
			font-size: var(--text-sm);
			color: var(--text-muted);

			a {
				display: inline-flex;
				align-items: center;
				gap: var(--space-1);
				color: var(--accent-text);
				font-weight: var(--weight-medium);
			}
		}
	}

	.posts li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border-subtle);
		font-size: var(--text-sm);

		&:last-child {
			border-bottom: none;
		}
	}

	.post-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
	}

	.timeline li {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
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

	.footer-note {
		margin-right: auto;
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.error {
		margin-bottom: var(--space-4);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--reject-soft);
		color: #991b1b;
		font-size: var(--text-sm);
	}

	.dim {
		color: var(--text-muted);
	}
</style>
