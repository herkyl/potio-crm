<script>
	// Tab 2 of the card modal: where this person came from, in full.
	//
	// Deliberately lossless. The classifier's label and reasoning are the summary,
	// but the raw Skool snapshot is rendered key by key underneath — including
	// keys this app has never heard of — plus the JSON itself. Nothing the
	// scanner captured is dropped on the way to the screen.

	import Icon from './Icon.svelte';
	import Badge from './Badge.svelte';
	import ConfidenceBar from './ConfidenceBar.svelte';
	import { fullDate, shortAge, percent } from '$lib/format.js';

	let { sources = [], posts = [] } = $props();

	// Fields we know the shape of lead; anything else the scanner starts
	// capturing still shows up, just after them.
	const KNOWN_ORDER = [
		'username',
		'first_name',
		'last_name',
		'bio',
		'company',
		'location',
		'role',
		'joined_at',
		'linkedin_url',
		'website_url'
	];

	function entries(snapshot) {
		const keys = Object.keys(snapshot ?? {});
		const ordered = [...KNOWN_ORDER.filter((k) => keys.includes(k))];
		for (const key of keys) if (!ordered.includes(key)) ordered.push(key);
		return ordered.map((key) => [key, snapshot[key]]);
	}

	const fieldLabel = (key) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

	const isUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

	function display(key, value) {
		if (value === null || value === undefined || value === '') return '—';
		if (typeof value === 'object') return JSON.stringify(value);
		if (key.endsWith('_at') && fullDate(value)) return fullDate(value);
		return String(value);
	}

	const labelTone = (label) =>
		({ PROSPECT: 'prospect', SPECIALIST: 'specialist', UNKNOWN: 'unknown' })[label] ?? 'neutral';
</script>

{#if sources.length === 0}
	<p class="none">Added manually — no source record.</p>
{/if}

{#each sources as source (source.id)}
	<section class="source">
		<header class="source-head">
			<strong>{source.source_name ?? source.source_id}</strong>
			<Badge tone={labelTone(source.label)}>{source.label ?? 'unclassified'}</Badge>
			<ConfidenceBar value={source.confidence} />
			<span class="conf">{percent(source.confidence)}</span>
			<span class="when" title={fullDate(source.found_at)}>found {shortAge(source.found_at)}</span>
		</header>

		<!-- The AI overview. Seeing why it flagged someone is what makes the label
		     worth trusting. -->
		<h4>Classification</h4>
		<div class="panel">
			{#if source.reasoning}
				<p class="prose">{source.reasoning}</p>
			{:else}
				<p class="dim">No reasoning recorded.</p>
			{/if}
		</div>

		{#if source.evidence}
			{@const evidence = source.evidence}
			<h4>Flagging post</h4>
			<article class="panel post">
				<header>
					<h5>{evidence.title || 'Untitled post'}</h5>
					{#if evidence.lead_score != null}
						<Badge tone="warn">lead score {percent(evidence.lead_score)}</Badge>
					{/if}
				</header>
				{#if evidence.body}<p class="prose body">{evidence.body}</p>{/if}
				<footer>
					{#if evidence.posted_at}<span>{fullDate(evidence.posted_at)}</span>{/if}
					{#if evidence.url}
						<a href={evidence.url} target="_blank" rel="noreferrer noopener">
							Open in Skool <Icon name="link" size={13} />
						</a>
					{/if}
				</footer>
				{#if evidence.reasoning}
					<p class="post-reasoning">{evidence.reasoning}</p>
				{/if}
			</article>
		{/if}

		<h4>Skool profile, as captured</h4>
		<dl class="raw">
			{#each entries(source.snapshot) as [key, value]}
				<div>
					<dt>{fieldLabel(key)}</dt>
					<dd class:dim={value === null || value === undefined || value === ''}>
						{#if isUrl(value)}
							<a href={value} target="_blank" rel="noreferrer noopener">{value}</a>
						{:else}
							{display(key, value)}
						{/if}
					</dd>
				</div>
			{/each}
		</dl>

		{#if source.raw}
			<!-- Everything the scanner captured, including keys ingest never copied
			     into the snapshot. This is the lossless half of the promise. -->
			<h4>Skool record, untouched</h4>
			<dl class="raw">
				{#each entries(source.raw) as [key, value]}
					<div>
						<dt>{fieldLabel(key)}</dt>
						<dd class:dim={value === null || value === undefined || value === ''}>
							{#if isUrl(value)}
								<a href={value} target="_blank" rel="noreferrer noopener">{value}</a>
							{:else}
								{display(key, value)}
							{/if}
						</dd>
					</div>
				{/each}
			</dl>
		{/if}

		<dl class="raw meta">
			<div>
				<dt>Skool member id</dt>
				<dd>{source.external_id ?? '—'}</dd>
			</div>
			<div>
				<dt>Found</dt>
				<dd>{fullDate(source.found_at) || '—'}</dd>
			</div>
			<div>
				<dt>Triaged</dt>
				<dd>{fullDate(source.triaged_at) || '—'}</dd>
			</div>
		</dl>

		<!-- The literal column contents, for when a rendered field isn't enough. -->
		<details class="json">
			<summary>Raw JSON</summary>
			<pre>{JSON.stringify(
					{ snapshot: source.snapshot, evidence: source.evidence, raw: source.raw },
					null,
					2
				)}</pre>
		</details>
	</section>
{/each}

{#if posts.length}
	<section class="source">
		<h4>Their posts ({posts.length})</h4>
		<ul class="posts">
			{#each posts as post (post.id)}
				<li>
					<details>
						<summary>
							<span class="post-title">{post.title || 'Untitled'}</span>
							{#if post.is_help_request}<Badge tone="warn">help request</Badge>{/if}
							{#if post.lead_score != null}
								<span class="score">{percent(post.lead_score)}</span>
							{/if}
							<span class="when" title={fullDate(post.posted_at)}>{shortAge(post.posted_at)}</span>
						</summary>
						{#if post.body}
							<p class="prose body">{post.body}</p>
						{:else}
							<p class="dim">No body captured.</p>
						{/if}
						{#if post.url}
							<p class="post-link">
								<a href={post.url} target="_blank" rel="noreferrer noopener">
									Open in Skool <Icon name="link" size={13} />
								</a>
							</p>
						{/if}
					</details>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style lang="less">
	.source + .source {
		margin-top: var(--space-5);
		padding-top: var(--space-5);
		border-top: 1px solid var(--border-subtle);
	}

	.source-head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
		margin-bottom: var(--space-4);

		strong {
			font-size: var(--text-lg);
			font-weight: var(--weight-semi);
		}
	}

	.conf {
		font-size: var(--text-xs);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.when {
		margin-left: auto;
		font-size: var(--text-xs);
		color: var(--text-muted);
		white-space: nowrap;
	}

	h4 {
		margin: var(--space-4) 0 var(--space-2);
		font-size: var(--text-xs);
		font-weight: var(--weight-semi);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.panel {
		padding: var(--space-4);
		border-radius: var(--radius-md);
		background: var(--bg-column);
		font-size: var(--text-base);
	}

	.prose {
		line-height: 1.55;
	}

	.body {
		white-space: pre-wrap;
		word-break: break-word;
	}

	.post {
		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--space-3);
			margin-bottom: var(--space-2);
		}

		h5 {
			font-size: var(--text-lg);
			font-weight: var(--weight-semi);
		}

		footer {
			display: flex;
			align-items: center;
			gap: var(--space-4);
			margin-top: var(--space-3);
			font-size: var(--text-sm);
			color: var(--text-muted);
		}
	}

	a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--accent-text);
		font-weight: var(--weight-medium);
		word-break: break-all;

		&:hover {
			text-decoration: underline;
		}
	}

	.post-reasoning {
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border-subtle);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.raw {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: var(--space-3);
		margin: 0;

		dt {
			font-size: var(--text-xs);
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--text-muted);
		}

		dd {
			margin: 0;
			font-size: var(--text-base);
			/* Bios and URLs are the long ones; let them wrap rather than stretch
			   the grid track. */
			white-space: pre-wrap;
			word-break: break-word;
		}
	}

	.meta {
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px dashed var(--border-subtle);
	}

	.json {
		margin-top: var(--space-3);

		summary {
			font-size: var(--text-xs);
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--text-muted);
			cursor: pointer;
		}

		pre {
			margin-top: var(--space-2);
			padding: var(--space-3);
			border-radius: var(--radius-md);
			background: var(--bg-column);
			font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
			font-size: var(--text-xs);
			line-height: 1.5;
			overflow-x: auto;
		}
	}

	.posts li {
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border-subtle);

		&:last-child {
			border-bottom: none;
		}

		summary {
			display: flex;
			align-items: center;
			gap: var(--space-2);
			font-size: var(--text-sm);
			cursor: pointer;
		}

		.prose {
			margin-top: var(--space-2);
			padding: var(--space-3);
			border-radius: var(--radius-md);
			background: var(--bg-column);
			font-size: var(--text-sm);
		}
	}

	.post-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.score {
		font-size: var(--text-xs);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.post-link {
		margin-top: var(--space-2);
		font-size: var(--text-sm);
	}

	.none,
	.dim {
		color: var(--text-muted);
	}

	@media (max-width: 720px) {
		.raw {
			grid-template-columns: minmax(0, 1fr);
		}

		.when {
			margin-left: 0;
		}
	}
</style>
