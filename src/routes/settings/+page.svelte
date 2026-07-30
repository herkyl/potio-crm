<script>
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import { fullDate } from '$lib/format.js';

	let { data } = $props();

	const SCANNER = ['members', 'member_classification', 'posts', 'post_classification'];
	const CRM = ['sources', 'source_leads', 'people', 'prospects', 'activities'];
</script>

<PageHeader title="Settings" />

<div class="scroll">
	<section>
		<h2>Database</h2>
		<p class="note">
			Shared with the Skool scanner. This app reads the scanner's tables and writes only to its own
			five.
		</p>
		<dl class="kv">
			<div>
				<dt>Host</dt>
				<dd><code>{data.host}</code></dd>
			</div>
			<div>
				<dt>Gemini key</dt>
				<dd>
					{#if data.hasGemini}<Badge tone="prospect">present</Badge>{:else}<Badge tone="unknown"
							>not set</Badge
						>{/if}
				</dd>
			</div>
			<div>
				<dt>Invite soft cap</dt>
				<dd>{data.inviteCap} / week</dd>
			</div>
		</dl>
	</section>

	<section>
		<h2>Tables</h2>
		<div class="tables">
			<div>
				<h3>Scanner <span class="dim">read-only</span></h3>
				<ul>
					{#each SCANNER as table}
						<li>
							<span>{table}</span>
							<strong>{data.report.counts[table] ?? '—'}</strong>
						</li>
					{/each}
				</ul>
			</div>
			<div>
				<h3>CRM</h3>
				<ul>
					{#each CRM as table}
						<li>
							<span>{table}</span>
							<strong>{data.report.counts[table] ?? '—'}</strong>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		{#if data.report.missingCrmTables.length}
			<p class="warn">
				Missing CRM tables: {data.report.missingCrmTables.join(', ')} — run
				<code>npm run migrate</code>.
			</p>
		{/if}
	</section>

	<section>
		<h2>Migrations</h2>
		{#if data.migrations.length === 0}
			<p class="note">None recorded.</p>
		{:else}
			<ul class="migrations">
				{#each data.migrations as migration}
					<li>
						<code>{migration.version}</code>
						<span class="dim">{fullDate(migration.applied_at)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style lang="less">
	.scroll {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-5) var(--space-6) var(--space-6);
		max-width: 780px;
	}

	section + section {
		margin-top: var(--space-6);
	}

	h2 {
		margin-bottom: var(--space-2);
		font-size: var(--text-lg);
		font-weight: var(--weight-semi);
	}

	h3 {
		margin-bottom: var(--space-2);
		font-size: var(--text-xs);
		font-weight: var(--weight-semi);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-secondary);
	}

	.note {
		margin-bottom: var(--space-3);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.kv {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--bg-column);

		dt {
			font-size: var(--text-xs);
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--text-muted);
		}

		dd {
			margin: 0;
			font-size: var(--text-base);
		}
	}

	.tables {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--space-4);
	}

	.tables ul {
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--bg-column);
	}

	.tables li {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		font-size: var(--text-sm);

		& + li {
			border-top: 1px solid var(--border-subtle);
		}

		strong {
			font-variant-numeric: tabular-nums;
		}
	}

	.migrations li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border-subtle);
		font-size: var(--text-sm);
	}

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--text-sm);
	}

	.warn {
		margin-top: var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--warn-soft);
		color: #92400e;
		font-size: var(--text-sm);
	}

	.dim {
		color: var(--text-muted);
		font-weight: var(--weight-normal);
	}

	@media (max-width: 720px) {
		.scroll {
			padding: var(--space-4);
		}

		.tables {
			grid-template-columns: 1fr;
		}

		code {
			word-break: break-all;
		}
	}
</style>
