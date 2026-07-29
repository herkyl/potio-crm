<script>
	// Board data as a sortable, filterable table with bulk edit. SPEC §3.5.

	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import {
		STAGES,
		STAGE_IDS,
		TERMINAL_STATUSES,
		stageLabel,
		statusLabel,
		isStale
	} from '$lib/stages.js';
	import { shortAge, fullDate, truncate, daysBetween } from '$lib/format.js';

	let { data, form } = $props();

	let search = $state('');
	let stageFilter = $state('any');
	let statusFilter = $state('open');
	let staleOnly = $state(false);
	let sortKey = $state('stage_entered_at');
	let sortDir = $state('desc');
	let selected = $state(new Set());

	const COLUMNS = [
		{ key: 'full_name', label: 'Name' },
		{ key: 'stage', label: 'Stage' },
		{ key: 'status', label: 'Status' },
		{ key: 'company', label: 'Company' },
		{ key: 'next_action_at', label: 'Next action' },
		{ key: 'stage_entered_at', label: 'In stage' }
	];

	const rows = $derived.by(() => {
		const needle = search.trim().toLowerCase();

		const filtered = data.prospects.filter((p) => {
			if (statusFilter !== 'any' && p.status !== statusFilter) return false;
			if (stageFilter !== 'any' && p.stage !== stageFilter) return false;
			if (staleOnly && !(p.status === 'open' && isStale(p.stage, p.stage_entered_at))) return false;
			if (!needle) return true;
			return [p.full_name, p.headline, p.company, p.location]
				.filter(Boolean)
				.some((field) => field.toLowerCase().includes(needle));
		});

		const dir = sortDir === 'asc' ? 1 : -1;
		return [...filtered].sort((a, b) => {
			const x = a[sortKey] ?? '';
			const y = b[sortKey] ?? '';
			if (x === y) return 0;
			return x > y ? dir : -dir;
		});
	});

	const allSelected = $derived(rows.length > 0 && rows.every((r) => selected.has(r.id)));

	function sortBy(key) {
		if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	function toggle(id) {
		const next = new Set(selected);
		next.has(id) ? next.delete(id) : next.add(id);
		selected = next;
	}
</script>

<PageHeader title="List">
	{#snippet actions()}
		<Button href="/board" icon="board">Board</Button>
	{/snippet}

	{#snippet subnav()}
		<nav class="views">
			<a class="view" href="/board"><Icon name="board" size={16} /> Board</a>
			<a class="view active" href="/list"><Icon name="list" size={16} /> List</a>
		</nav>

		<div class="stats"><strong>{rows.length}</strong> shown</div>

		<div class="filters">
			<label class="search">
				<Icon name="search" size={15} />
				<input type="search" placeholder="Search…" bind:value={search} />
			</label>
			<select bind:value={statusFilter} aria-label="Status">
				<option value="any">Any status</option>
				<option value="open">Open</option>
				{#each TERMINAL_STATUSES as terminal}
					<option value={terminal.id}>{terminal.label}</option>
				{/each}
			</select>
			<select bind:value={stageFilter} aria-label="Stage">
				<option value="any">Any stage</option>
				{#each STAGES as stage}
					<option value={stage.id}>{stage.label}</option>
				{/each}
			</select>
			<button class="chip" class:on={staleOnly} onclick={() => (staleOnly = !staleOnly)}>
				<Icon name="warn" size={13} /> Stale
			</button>
		</div>
	{/snippet}
</PageHeader>

{#if form?.done}
	<!-- The bulk target is either a stage or a closing status. -->
	<p class="flash">
		Moved {form.done} to {STAGE_IDS.includes(form.target)
			? stageLabel(form.target)
			: statusLabel(form.target)}.
	</p>
{/if}

{#if selected.size > 0}
	<form
		class="bulk"
		method="POST"
		action="?/bulk"
		use:enhance={() =>
			async ({ update }) => {
				await update();
				selected = new Set();
			}}
	>
		{#each [...selected] as id}
			<input type="hidden" name="prospectId" value={id} />
		{/each}
		<span class="bulk-count">{selected.size} selected</span>
		<label>
			<span>Move to</span>
			<select name="target" required>
				<option value="">Choose…</option>
				{#each STAGES as stage}
					<option value={stage.id}>{stage.label}</option>
				{/each}
				{#each TERMINAL_STATUSES as terminal}
					<option value={terminal.id}>{terminal.label}</option>
				{/each}
			</select>
		</label>
		<Button size="sm" variant="primary" type="submit">Apply</Button>
		<button type="button" class="bulk-clear" onclick={() => (selected = new Set())}>Clear</button>
	</form>
{/if}

<div class="scroll">
	{#if rows.length === 0}
		<div class="empty">
			<Icon name="inbox" size={28} />
			<p>No prospects match these filters.</p>
			<Button size="sm" href="/sources">Go to triage</Button>
		</div>
	{:else}
		<table>
			<thead>
				<tr>
					<th class="pick">
						<input
							type="checkbox"
							checked={allSelected}
							onchange={() => (selected = allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
							aria-label="Select all"
						/>
					</th>
					{#each COLUMNS as column}
						<th>
							<button onclick={() => sortBy(column.key)} class:sorted={sortKey === column.key}>
								{column.label}
								{#if sortKey === column.key}
									<Icon name={sortDir === 'asc' ? 'chevronDown' : 'chevronDown'} size={12} />
								{/if}
							</button>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					{@const stale = row.status === 'open' && isStale(row.stage, row.stage_entered_at)}
					<tr class:picked={selected.has(row.id)}>
						<td class="pick">
							<input
								type="checkbox"
								checked={selected.has(row.id)}
								onchange={() => toggle(row.id)}
								aria-label="Select {row.full_name}"
							/>
						</td>
						<td>
							<a class="who" href="/board/{row.id}">
								<Avatar name={row.full_name} id={row.person_id} size={26} />
								<span>
									<span class="name">{row.full_name}</span>
									<span class="headline">{truncate(row.headline, 60)}</span>
								</span>
							</a>
						</td>
						<td><Badge tone="neutral">{stageLabel(row.stage)}</Badge></td>
						<td>
							{#if row.status === 'open'}
								<span class="dim">open</span>
							{:else}
								<Badge tone={row.status === 'won' ? 'prospect' : 'unknown'}>
									{statusLabel(row.status)}
								</Badge>
							{/if}
						</td>
						<td class="dim">{row.company || '—'}</td>
						<td>
							{#if row.next_action}
								<span class="next">{truncate(row.next_action, 28)}</span>
								{#if row.next_action_at}
									<span class="dim">{shortAge(row.next_action_at)}</span>
								{/if}
							{:else}
								<span class="dim">—</span>
							{/if}
						</td>
						<td>
							<span class="age" class:stale title={fullDate(row.stage_entered_at)}>
								{daysBetween(row.stage_entered_at)}d
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style lang="less">
	.views {
		display: flex;
		gap: var(--space-4);
	}

	.view {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-1);
		border-bottom: 2px solid transparent;
		font-size: var(--text-base);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);

		&:hover {
			color: var(--text-primary);
		}

		&.active {
			color: var(--text-primary);
			font-weight: var(--weight-semi);
			border-bottom-color: var(--accent);

			:global(svg) {
				color: var(--accent-text);
			}
		}
	}

	.stats {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		white-space: nowrap;

		strong {
			color: var(--text-primary);
			font-weight: var(--weight-semi);
		}
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

		&:focus-within {
			border-color: var(--accent);
		}

		input {
			width: 150px;
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

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);

		&.on {
			background: var(--accent-soft);
			border-color: var(--accent-soft);
			color: var(--accent-text);
		}
	}

	.flash {
		margin: var(--space-3) var(--space-6) 0;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--accent-soft);
		color: var(--accent-text);
		font-size: var(--text-sm);
	}

	.bulk {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: none;
		padding: var(--space-3) var(--space-6);
		background: var(--accent-soft);
		border-bottom: 1px solid var(--border-subtle);

		label {
			display: flex;
			align-items: center;
			gap: var(--space-2);
			font-size: var(--text-sm);
			color: var(--accent-text);
		}
	}

	.bulk-count {
		font-size: var(--text-sm);
		font-weight: var(--weight-semi);
		color: var(--accent-text);
	}

	.bulk-clear {
		margin-left: auto;
		font-size: var(--text-sm);
		color: var(--accent-text);
		text-decoration: underline;
	}

	.scroll {
		flex: 1;
		overflow: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-app);
		border-bottom: 1px solid var(--border-subtle);
		text-align: left;

		&:first-child {
			padding-left: var(--space-6);
		}

		&:last-child {
			padding-right: var(--space-6);
		}

		button {
			display: inline-flex;
			align-items: center;
			gap: var(--space-1);
			font-size: var(--text-xs);
			font-weight: var(--weight-semi);
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--text-muted);

			&:hover,
			&.sorted {
				color: var(--text-primary);
			}
		}
	}

	tbody tr {
		border-bottom: 1px solid var(--border-subtle);

		&:hover {
			background: var(--bg-hover);
		}

		&.picked {
			background: var(--accent-soft);
		}
	}

	td {
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-sm);
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

		&:hover .name {
			text-decoration: underline;
		}
	}

	.name {
		display: block;
		font-size: var(--text-base);
		font-weight: var(--weight-semi);
	}

	.headline {
		display: block;
		font-size: var(--text-xs);
		color: var(--text-secondary);
	}

	.next {
		margin-right: var(--space-2);
	}

	.age {
		font-variant-numeric: tabular-nums;
		color: var(--text-secondary);

		&.stale {
			color: var(--warn);
			font-weight: var(--weight-semi);
		}
	}

	.dim {
		color: var(--text-muted);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-6);
		margin: var(--space-6) auto;
		max-width: 380px;
		text-align: center;
		color: var(--text-secondary);
	}
</style>
