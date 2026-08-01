<script>
	// The one card modal. Board, list and triage all render this and nothing else.
	//
	// Two things make a single component possible across three views:
	//
	//  1. It talks to /api/{prospect,candidate}/[id] rather than to form actions
	//     scoped to a route, so it doesn't care which page it's mounted on.
	//  2. It normalises both kinds of record into one `fields` shape, so the tabs
	//     don't branch. A candidate is a raw Skool snapshot with the name in two
	//     halves; a prospect is a `people` row. The API translates on the way in.
	//
	// The only thing that varies by entry point is the footer: a candidate can be
	// accepted or rejected, a prospect is already on the board.

	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import ProspectDetailsTab from './ProspectDetailsTab.svelte';
	import ProspectSourceTab from './ProspectSourceTab.svelte';
	import { parseJson } from '$lib/format.js';

	let {
		/** 'prospect' | 'candidate' */
		kind,
		id,
		/** Ordered ids of the set the opening view is showing, for prev/next. */
		ids = [],
		onclose,
		onselect,
		/** Fired after any write, so the view underneath can refresh itself. */
		onchanged
	} = $props();

	const TABS = [
		{ id: 'details', label: 'Details' },
		{ id: 'source', label: 'Source' }
	];

	let tab = $state('details');
	let record = $state(null);
	let loadError = $state(null);
	let saveError = $state(null);
	let saving = $state(0);
	let savedAt = $state(0);
	let duplicate = $state(null);

	const endpoint = $derived(`/api/${kind}/${id}`);

	// Position within the set the opening view handed us. -1 when the record
	// isn't in it (a stale link, or a row filtered out since it was opened).
	const index = $derived(ids.indexOf(id));
	const hasPrev = $derived(index > 0);
	const hasNext = $derived(index >= 0 && index < ids.length - 1);

	// Locally applied edits layered over the server's copy, so a field reflects
	// the change immediately and the request settles behind it.
	let edits = $state({});

	async function load() {
		loadError = null;
		try {
			const response = await fetch(endpoint);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			record = await response.json();
			edits = {};
		} catch (err) {
			loadError = err.message;
			record = null;
		}
	}

	$effect(() => {
		// Re-fetch whenever the open record changes; stepping with the arrows
		// swaps `id` without remounting.
		endpoint;
		record = null;
		duplicate = null;
		saveError = null;
		load();
	});

	/** Normalised, editable view of whichever kind is open. */
	const base = $derived.by(() => {
		if (!record) return {};

		if (kind === 'prospect') {
			const p = record.prospect;
			return {
				full_name: p.full_name,
				company: p.company,
				headline: p.headline,
				location: p.location,
				linkedin_url: p.linkedin_url,
				website_url: p.website_url,
				next_action: p.next_action,
				next_action_at: p.next_action_at
			};
		}

		const snap = parseJson(record.snapshot_json, {});
		return {
			full_name:
				[snap.first_name, snap.last_name].filter(Boolean).join(' ') || snap.username || 'Unknown',
			company: snap.company,
			headline: snap.bio,
			location: snap.location,
			linkedin_url: snap.linkedin_url,
			website_url: snap.website_url,
			next_action: null,
			next_action_at: null
		};
	});

	const fields = $derived({ ...base, ...edits });

	/** What the tabs consume. Candidates have no prospect row, so no timeline. */
	const subject = $derived.by(() => {
		if (!record) return { prospect: null, activities: [], status: null };

		if (kind === 'prospect') {
			return {
				kind,
				prospect: record.prospect,
				activities: record.activities ?? [],
				status: record.prospect?.status ?? null,
				prospectId: record.prospect?.id ?? null
			};
		}

		return {
			kind,
			prospect: null,
			activities: [],
			status: record.status,
			prospectId: record.prospect_id ?? null
		};
	});

	/** Provenance rows with their JSON columns parsed, for the source tab. */
	const sources = $derived.by(() => {
		if (!record) return [];

		const rows =
			kind === 'prospect'
				? (record.provenance ?? [])
				: [
						{
							id: record.id,
							source_id: record.source_id,
							source_name: record.source_name,
							external_id: record.external_id,
							label: record.label,
							confidence: record.confidence,
							reasoning: record.reasoning,
							evidence_json: record.evidence_json,
							snapshot_json: record.snapshot_json,
							member_raw_json: record.member_raw_json,
							found_at: record.found_at,
							triaged_at: record.triaged_at
						}
					];

		return rows.map((row) => ({
			...row,
			snapshot: parseJson(row.snapshot_json, {}),
			evidence: parseJson(row.evidence_json, null),
			raw: parseJson(row.member_raw_json, null)
		}));
	});

	const posts = $derived(record?.posts ?? []);
	const displayName = $derived(fields.full_name || 'Loading…');

	/** POST an op. Returns true on success; surfaces the message otherwise. */
	async function mutate(op, payload = {}) {
		saveError = null;
		saving++;
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ op, ...payload })
			});
			const body = await response.json().catch(() => ({}));

			if (response.status === 409 && body.duplicate) {
				duplicate = body.duplicate;
				return false;
			}
			if (!response.ok || body.ok === false) {
				saveError = body.error ?? `Save failed (${response.status})`;
				return false;
			}

			savedAt = Date.now();
			await load();
			onchanged?.();
			return true;
		} catch (err) {
			saveError = err.message ?? 'Save failed';
			return false;
		} finally {
			saving--;
		}
	}

	/**
	 * Autosave for a single field. Stage and next-action are their own ops
	 * server-side but arrive here through the same callback, so the tabs never
	 * need to know the difference.
	 */
	async function save(name, value) {
		if (name === 'stage') return void mutate('stage', { stage: value });
		if (name === 'next_action' || name === 'next_action_at') {
			const next = { ...fields, [name]: value };
			edits = { ...edits, [name]: value };
			return void mutate('nextAction', {
				next_action: next.next_action ?? '',
				next_action_at: next.next_action_at ?? ''
			});
		}

		const previous = fields[name];
		edits = { ...edits, [name]: value }; // optimistic
		saveError = null;
		saving++;

		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					op: 'person',
					personId: record?.prospect?.person_id,
					patch: { [name]: value }
				})
			});
			const body = await response.json().catch(() => ({}));

			if (!response.ok || body.ok === false) {
				// Roll back, so the field never claims a save that didn't happen.
				edits = { ...edits, [name]: previous };
				saveError = body.error ?? `Save failed (${response.status})`;
				return;
			}

			savedAt = Date.now();
			onchanged?.();
		} catch (err) {
			edits = { ...edits, [name]: previous };
			saveError = err.message ?? 'Save failed';
		} finally {
			saving--;
		}
	}

	async function accept(options = {}) {
		duplicate = null;
		const ok = await mutate('accept', options);
		if (ok) onclose?.();
	}

	async function reject() {
		const ok = await mutate('reject');
		if (ok) onclose?.();
	}

	const step = (delta) => {
		const next = ids[index + delta];
		if (next) onselect?.(next);
	};

	/**
	 * Arrows or j/k step through the set. Ignored while typing, otherwise editing
	 * a headline would page through cards on every left-arrow.
	 */
	function onkeydown(event) {
		if (event.metaKey || event.ctrlKey || event.altKey) return;

		const el = event.target;
		const typing =
			el instanceof HTMLElement &&
			(el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
		if (typing) return;

		if (event.key === 'ArrowLeft' || event.key === 'k') step(-1);
		else if (event.key === 'ArrowRight' || event.key === 'j') step(1);
		else return;

		event.preventDefault();
	}

	// "Saved" lingers briefly so a fast save still registers visually.
	let showSaved = $state(false);
	$effect(() => {
		if (!savedAt) return;
		showSaved = true;
		const timer = setTimeout(() => (showSaved = false), 1600);
		return () => clearTimeout(timer);
	});
</script>

<svelte:window {onkeydown} />

<Modal {onclose} width={880} title={displayName}>
	{#snippet header()}
		<div class="head">
			<Avatar
				name={displayName}
				id={record?.prospect?.person_id ?? record?.external_id ?? id}
				size={40}
			/>

			<div class="head-text">
				<h2>{displayName}</h2>
				<p class="sub">{fields.headline || fields.company || 'No headline'}</p>
			</div>

			<div class="head-right">
				<span class="status" aria-live="polite">
					{#if saving > 0}
						Saving…
					{:else if showSaved}
						<Icon name="check" size={13} /> Saved
					{/if}
				</span>

				{#if ids.length > 1 && index >= 0}
					<div class="stepper">
						<button
							onclick={() => step(-1)}
							disabled={!hasPrev}
							aria-label="Previous"
							title="Previous (←)"
						>
							<Icon name="chevronLeft" size={16} />
						</button>
						<span class="position">{index + 1} of {ids.length}</span>
						<button onclick={() => step(1)} disabled={!hasNext} aria-label="Next" title="Next (→)">
							<Icon name="chevronRight" size={16} />
						</button>
					</div>
				{/if}
			</div>
		</div>

		<nav class="tabs">
			{#each TABS as t}
				<button class="tab" class:active={tab === t.id} onclick={() => (tab = t.id)}>
					{t.label}
					{#if t.id === 'source' && sources.length > 1}
						<span class="tab-count">{sources.length}</span>
					{/if}
				</button>
			{/each}
		</nav>
	{/snippet}

	{#if loadError}
		<p class="error">Couldn't load this record: {loadError}</p>
	{:else if !record}
		<p class="loading">Loading…</p>
	{:else}
		{#if saveError}
			<p class="error">{saveError}</p>
		{/if}

		{#if duplicate}
			<!-- SPEC §4.2: a name match is a hint, not proof. Never auto-merged. -->
			<div class="duplicate">
				<p class="dup-title"><Icon name="warn" size={16} /> Possible duplicate</p>
				<p class="dup-detail">
					<strong>{duplicate.proposed.full_name}</strong> has no LinkedIn URL, and that name is already
					in the database.
				</p>
				<ul>
					{#each duplicate.candidates as person (person.id)}
						<li>
							<span>
								<strong>{person.full_name}</strong>
								<em>{person.headline || person.company || 'No headline'}</em>
							</span>
							<Button size="sm" onclick={() => accept({ personId: person.id })}>
								Attach to this one
							</Button>
						</li>
					{/each}
				</ul>
				<div class="dup-actions">
					<Button
						size="sm"
						variant="primary"
						icon="plus"
						onclick={() => accept({ forceNew: true })}
					>
						Different person — create new
					</Button>
					<Button size="sm" variant="ghost" onclick={() => (duplicate = null)}>Cancel</Button>
				</div>
			</div>
		{/if}

		{#if tab === 'details'}
			<ProspectDetailsTab {subject} {fields} {save} {mutate} />
		{:else}
			<ProspectSourceTab {sources} {posts} />
		{/if}
	{/if}

	{#snippet footer()}
		{#if record}
			{#if kind === 'candidate' && subject.status !== 'accepted'}
				<span class="foot-note">
					{subject.status === 'rejected' ? 'Rejected — accepting promotes it normally.' : ''}
				</span>
				{#if subject.status !== 'rejected'}
					<Button variant="danger" icon="x" onclick={reject}>Reject</Button>
				{/if}
				<Button variant="primary" icon="check" onclick={() => accept()}>Accept</Button>
			{:else}
				<span class="foot-note">
					{#if fields.linkedin_url}
						Send the invite in LinkedIn yourself, then move the card.
					{:else}
						No LinkedIn URL yet — add one above.
					{/if}
				</span>
				<Button onclick={() => onclose?.()}>Done</Button>
			{/if}
		{/if}
	{/snippet}
</Modal>

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

	.head-right {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: none;
	}

	/* Autosave has no button, so this is the only confirmation a save happened. */
	.status {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 58px;
		justify-content: flex-end;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: var(--space-1);

		button {
			display: grid;
			place-items: center;
			width: 26px;
			height: 26px;
			border-radius: var(--radius-sm);
			color: var(--text-secondary);
			transition: background var(--transition);

			&:hover:not(:disabled) {
				background: var(--bg-column);
				color: var(--text-primary);
			}

			&:disabled {
				opacity: 0.3;
				cursor: default;
			}
		}
	}

	.position {
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.tabs {
		display: flex;
		gap: var(--space-4);
		width: 100%;
		margin-top: var(--space-4);
		margin-bottom: calc(var(--space-4) * -1);
	}

	.tab {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-1) var(--space-3);
		border-bottom: 2px solid transparent;
		font-size: var(--text-base);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);
		transition: color var(--transition);

		&:hover {
			color: var(--text-primary);
		}

		&.active {
			color: var(--text-primary);
			font-weight: var(--weight-semi);
			border-bottom-color: var(--accent);
		}
	}

	.tab-count {
		padding: 0 var(--space-2);
		border-radius: var(--radius-pill);
		background: var(--bg-column);
		font-size: var(--text-xs);
	}

	.duplicate {
		margin-bottom: var(--space-4);
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--warn-soft);
		border: 1px solid #f3e0ab;
		color: #92400e;

		ul {
			margin: var(--space-3) 0;
			border-radius: var(--radius-md);
			background: #ffffff;
			overflow: hidden;
		}

		li {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--space-3);
			padding: var(--space-3);
			color: var(--text-primary);

			& + li {
				border-top: 1px solid var(--border-subtle);
			}

			em {
				display: block;
				font-style: normal;
				font-size: var(--text-sm);
				color: var(--text-secondary);
			}
		}
	}

	.dup-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: var(--weight-semi);
	}

	.dup-detail {
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.dup-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	.foot-note {
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

	.loading {
		padding: var(--space-6);
		text-align: center;
		color: var(--text-muted);
	}

	@media (max-width: 720px) {
		h2 {
			font-size: var(--text-lg);
		}

		.head {
			flex-wrap: wrap;
			gap: var(--space-2);
		}

		.head-right {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
