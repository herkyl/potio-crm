<script>
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import ConfidenceBar from '$lib/components/ConfidenceBar.svelte';
	import CandidateModal from '$lib/components/CandidateModal.svelte';
	import DuplicatePrompt from '$lib/components/DuplicatePrompt.svelte';
	import { parseJson, truncate, shortAge, fullDate } from '$lib/format.js';

	let { data, form } = $props();

	let selected = $state(new Set());
	let openLeadId = $state(null);
	let lastUndo = $state(null);

	const TABS = [
		{ id: 'new', label: 'New' },
		{ id: 'accepted', label: 'Accepted' },
		{ id: 'rejected', label: 'Rejected' },
		{ id: 'all', label: 'All' }
	];

	// Flatten the snapshot so the table can read plain fields.
	const rows = $derived(
		data.candidates.map((c) => {
			const snap = parseJson(c.snapshot_json, {});
			const evidence = parseJson(c.evidence_json, null);
			const name =
				[snap.first_name, snap.last_name].filter(Boolean).join(' ') || snap.username || 'Unknown';
			return { ...c, snap, evidence, name };
		})
	);

	const allSelected = $derived(rows.length > 0 && rows.every((r) => selected.has(r.id)));
	const isFiltered = $derived(data.filters.label !== 'any' || data.filters.minConfidence > 0);

	// Capture the undo token from the most recent action.
	$effect(() => {
		if (form?.undo) lastUndo = form.undo;
	});

	// A fresh result set means the old selection no longer refers to visible rows.
	$effect(() => {
		data.candidates;
		selected = new Set();
	});

	function setParam(patch) {
		const params = new URLSearchParams(page.url.searchParams);
		for (const [key, value] of Object.entries(patch)) {
			if (value === null || value === '') params.delete(key);
			else params.set(key, String(value));
		}
		goto(`?${params}`, { keepFocus: true, noScroll: true });
	}

	function toggle(id) {
		const next = new Set(selected);
		next.has(id) ? next.delete(id) : next.add(id);
		selected = next;
	}

	function toggleAll() {
		selected = allSelected ? new Set() : new Set(rows.map((r) => r.id));
	}

	let searchValue = $state(data.filters.search);
	let searchTimer;

	function onSearch(event) {
		searchValue = event.currentTarget.value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => setParam({ q: searchValue }), 250);
	}

	const labelTone = (label) =>
		({ PROSPECT: 'prospect', SPECIALIST: 'specialist', UNKNOWN: 'unknown' })[label] ?? 'neutral';
</script>

<PageHeader title={data.source.name}>
	{#snippet actions()}
		{#if lastUndo}
			<form
				method="POST"
				action="?/undo"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						lastUndo = null;
					};
				}}
			>
				<input type="hidden" name="token" value={JSON.stringify(lastUndo)} />
				<Button type="submit" icon="undo">Undo last</Button>
			</form>
		{/if}
		<Button href="/sources" variant="ghost" icon="chevronLeft">All sources</Button>
	{/snippet}

	{#snippet subnav()}
		<nav class="tabs">
			{#each TABS as tab}
				<button
					class="tab"
					class:active={data.filters.tab === tab.id}
					onclick={() => setParam({ tab: tab.id })}
				>
					{tab.label}
					<span class="tab-count">{data.counts[tab.id]}</span>
				</button>
			{/each}
		</nav>

		<div class="filters">
			<label class="search">
				<Icon name="search" size={15} />
				<input
					type="search"
					placeholder="Search name, bio, reasoning…"
					value={searchValue}
					oninput={onSearch}
				/>
			</label>

			<select
				aria-label="Classification label"
				value={data.filters.label}
				onchange={(e) => setParam({ label: e.currentTarget.value })}
			>
				<option value="any">Any label</option>
				<option value="PROSPECT">Prospect</option>
				<option value="SPECIALIST">Specialist</option>
				<option value="UNKNOWN">Unknown</option>
			</select>

			<select
				aria-label="Minimum confidence"
				value={String(data.filters.minConfidence)}
				onchange={(e) => setParam({ minConfidence: e.currentTarget.value })}
			>
				<option value="0">Any confidence</option>
				<option value="0.6">60%+</option>
				<option value="0.8">80%+</option>
				<option value="0.9">90%+</option>
			</select>

			<!-- The classifier will be wrong sometimes; this is how you catch it. -->
			<Button
				size="sm"
				variant={isFiltered ? 'secondary' : 'ghost'}
				onclick={() =>
					setParam(
						isFiltered
							? { label: 'any', minConfidence: 0 }
							: { label: 'PROSPECT', minConfidence: 0.6 }
					)}
			>
				{isFiltered ? 'Show everything' : 'Back to prospects'}
			</Button>
		</div>
	{/snippet}
</PageHeader>

{#if form?.duplicate}
	<DuplicatePrompt duplicate={form.duplicate} />
{/if}

{#if selected.size > 0}
	<div class="bulk">
		<span class="bulk-count">{selected.size} selected</span>
		<form method="POST" action="?/bulk" use:enhance>
			{#each [...selected] as id}
				<input type="hidden" name="leadId" value={id} />
			{/each}
			<button class="bulk-btn accept" name="decision" value="accept">
				<Icon name="check" size={15} /> Accept {selected.size}
			</button>
			<button class="bulk-btn reject" name="decision" value="reject">
				<Icon name="x" size={15} /> Reject {selected.size}
			</button>
		</form>
		<button class="bulk-clear" onclick={() => (selected = new Set())}>Clear</button>
	</div>
{/if}

<div class="scroll">
	{#if rows.length === 0}
		<div class="empty">
			<Icon name="inbox" size={28} />
			<p>Nothing here.</p>
			<p class="dim">
				{#if data.filters.tab === 'new'}
					Every candidate matching these filters has been triaged.
				{:else}
					No candidates match these filters.
				{/if}
			</p>
			{#if isFiltered}
				<Button size="sm" onclick={() => setParam({ label: 'any', minConfidence: 0 })}>
					Show everything
				</Button>
			{/if}
		</div>
	{:else}
		<table>
			<thead>
				<tr>
					<th class="pick">
						<input
							type="checkbox"
							checked={allSelected}
							onchange={toggleAll}
							aria-label="Select all"
						/>
					</th>
					<th>Name</th>
					<th>Classification</th>
					<th class="evidence-col">Evidence</th>
					<th class="found">Found</th>
					<th class="row-actions"></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<tr
						class:picked={selected.has(row.id)}
						onclick={() => (openLeadId = row.id)}
						tabindex="0"
						onkeydown={(e) => {
							if (e.key === 'Enter') openLeadId = row.id;
						}}
					>
						<td class="pick">
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
							<span onclick={(e) => e.stopPropagation()}>
								<input
									type="checkbox"
									checked={selected.has(row.id)}
									onchange={() => toggle(row.id)}
									aria-label="Select {row.name}"
								/>
							</span>
						</td>

						<td>
							<div class="who">
								<Avatar name={row.name} id={row.external_id} size={30} />
								<div class="who-text">
									<p class="name">{row.name}</p>
									<p class="headline">{truncate(row.snap.bio, 90) || '—'}</p>
								</div>
							</div>
						</td>

						<td>
							<div class="classification">
								<Badge tone={labelTone(row.label)}>{row.label ?? 'unclassified'}</Badge>
								<ConfidenceBar value={row.confidence} />
							</div>
						</td>

						<td class="evidence-col">
							{#if row.evidence}
								<span class="evidence" title={row.evidence.title}>
									<Icon name="note" size={13} />
									{truncate(row.evidence.title, 44)}
								</span>
							{:else if row.reasoning}
								<span class="reason" title={row.reasoning}>{truncate(row.reasoning, 60)}</span>
							{:else}
								<span class="dim">—</span>
							{/if}
						</td>

						<td class="found">
							<span title={fullDate(row.found_at)}>{shortAge(row.found_at)}</span>
						</td>

						<td class="row-actions">
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
							<div class="actions" onclick={(e) => e.stopPropagation()}>
								{#if row.status === 'accepted'}
									{#if row.prospect_id}
										<a class="link" href="/board/{row.prospect_id}">
											On board <Icon name="arrowRight" size={13} />
										</a>
									{:else}
										<span class="dim">Accepted</span>
									{/if}
								{:else}
									<form method="POST" action="?/accept" use:enhance>
										<input type="hidden" name="leadId" value={row.id} />
										<button class="act accept" title="Accept" aria-label="Accept {row.name}">
											<Icon name="check" size={15} />
										</button>
									</form>
									{#if row.status !== 'rejected'}
										<form method="POST" action="?/reject" use:enhance>
											<input type="hidden" name="leadId" value={row.id} />
											<button class="act reject" title="Reject" aria-label="Reject {row.name}">
												<Icon name="x" size={15} />
											</button>
										</form>
									{:else}
										<span class="rejected-flag">Rejected</span>
									{/if}
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

{#if openLeadId}
	<CandidateModal
		sourceId={data.source.id}
		leadId={openLeadId}
		onclose={() => (openLeadId = null)}
	/>
{/if}

<style lang="less">
	.tabs {
		display: flex;
		gap: var(--space-1);
	}

	.tab {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-1);
		margin-right: var(--space-4);
		border-bottom: 2px solid transparent;
		font-size: var(--text-base);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);
		transition:
			color var(--transition),
			border-color var(--transition);

		&:hover {
			color: var(--text-primary);
		}

		/* Green underline on the active tab, matching the reference sub-nav. */
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
		font-variant-numeric: tabular-nums;
	}

	.tab.active .tab-count {
		background: var(--accent-soft);
		color: var(--accent-text);
	}

	.filters {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-left: auto;
	}

	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		height: 32px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		color: var(--text-muted);
		transition: border-color var(--transition);

		&:focus-within {
			border-color: var(--accent);
		}

		input {
			width: 200px;
			border: none;
			outline: none;
			background: none;
			font-size: var(--text-sm);
			color: var(--text-primary);
		}
	}

	select {
		height: 32px;
		padding: 0 var(--space-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: #ffffff;
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.bulk {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: none;
		padding: var(--space-3) var(--space-6);
		background: var(--accent-soft);
		border-bottom: 1px solid var(--border-subtle);

		form {
			display: flex;
			gap: var(--space-2);
		}
	}

	.bulk-count {
		font-size: var(--text-sm);
		font-weight: var(--weight-semi);
		color: var(--accent-text);
	}

	.bulk-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		height: 30px;
		border-radius: var(--radius-lg);
		font-size: var(--text-sm);
		font-weight: var(--weight-semi);
		transition:
			background var(--transition),
			color var(--transition);

		&.accept {
			background: var(--accent);
			color: #ffffff;

			&:hover {
				background: var(--accent-hover);
			}
		}

		&.reject {
			background: #ffffff;
			color: var(--reject);

			&:hover {
				background: var(--reject-soft);
			}
		}
	}

	.bulk-clear {
		margin-left: auto;
		font-size: var(--text-sm);
		color: var(--accent-text);
		text-decoration: underline;
	}

	.scroll {
		flex: 1;
		overflow-y: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: var(--space-3) var(--space-3);
		background: var(--bg-app);
		border-bottom: 1px solid var(--border-subtle);
		text-align: left;
		font-size: var(--text-xs);
		font-weight: var(--weight-semi);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);

		&:first-child {
			padding-left: var(--space-6);
		}

		&:last-child {
			padding-right: var(--space-6);
		}
	}

	tbody tr {
		cursor: pointer;
		border-bottom: 1px solid var(--border-subtle);
		transition: background var(--transition);

		&:hover {
			background: var(--bg-hover);
		}

		&.picked {
			background: var(--accent-soft);
		}
	}

	td {
		padding: var(--space-3);
		vertical-align: middle;

		&:first-child {
			padding-left: var(--space-6);
		}

		&:last-child {
			padding-right: var(--space-6);
		}
	}

	.pick {
		width: 34px;

		input {
			cursor: pointer;
			accent-color: var(--accent);
			width: 15px;
			height: 15px;
		}
	}

	.who {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.who-text {
		min-width: 0;
	}

	.name {
		font-size: var(--text-base);
		font-weight: var(--weight-semi);
	}

	.headline {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 42ch;
	}

	.classification {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.evidence-col {
		max-width: 30ch;
	}

	.evidence {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 2px var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--warn-soft);
		color: #92400e;
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
	}

	.reason {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.found {
		width: 70px;
		font-size: var(--text-xs);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.row-actions {
		width: 110px;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	/* Legible at row scale but not shouting — the modal's versions are larger. */
	.act {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		background: #ffffff;
		transition:
			background var(--transition),
			color var(--transition),
			border-color var(--transition);

		&.accept {
			color: var(--accent-text);

			&:hover {
				background: var(--accent);
				border-color: var(--accent);
				color: #ffffff;
			}
		}

		&.reject {
			color: var(--text-muted);

			&:hover {
				background: var(--reject-soft);
				border-color: var(--reject-soft);
				color: var(--reject);
			}
		}
	}

	.link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--accent-text);

		&:hover {
			text-decoration: underline;
		}
	}

	.rejected-flag {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.dim {
		color: var(--text-muted);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-6) var(--space-5);
		margin: var(--space-6) auto;
		max-width: 380px;
		text-align: center;
		color: var(--text-secondary);

		p {
			font-size: var(--text-base);
		}
	}
</style>
