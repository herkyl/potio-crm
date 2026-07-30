<script>
	// The pre-acceptance variant of the detail modal (SPEC §3.2). Shows the full
	// picture behind a row — profile, the classifier's reasoning, the post that
	// flagged them — and lets every field be corrected before accepting.
	//
	// LinkedIn URL matters most: it's the dedupe key, and most Skool profiles
	// leave it blank.

	import { enhance } from '$app/forms';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import Badge from './Badge.svelte';
	import ConfidenceBar from './ConfidenceBar.svelte';
	import { parseJson, fullDate, truncate } from '$lib/format.js';
	import { normaliseLinkedInSlug } from '$lib/linkedin.js';

	let { sourceId, leadId, onclose } = $props();

	let candidate = $state(null);
	let loadError = $state(null);
	let saving = $state(false);
	let savedAt = $state(null);

	const snap = $derived(parseJson(candidate?.snapshot_json, {}));
	const evidence = $derived(parseJson(candidate?.evidence_json, null));
	const name = $derived(
		[snap.first_name, snap.last_name].filter(Boolean).join(' ') || snap.username || 'Unknown'
	);
	let linkedinValue = $state('');

	// Live feedback on what the pasted URL will actually dedupe on.
	const slugPreview = $derived(normaliseLinkedInSlug(linkedinValue));

	$effect(() => {
		let cancelled = false;
		candidate = null;
		loadError = null;

		fetch(`/sources/${sourceId}/candidate/${leadId}`)
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then((data) => {
				if (cancelled) return;
				candidate = data;
				linkedinValue = parseJson(data.snapshot_json, {}).linkedin_url ?? '';
			})
			.catch((err) => {
				if (!cancelled) loadError = err.message;
			});

		return () => {
			cancelled = true;
		};
	});

	const otherPosts = $derived(
		(candidate?.posts ?? []).filter((p) => !evidence || p.id !== evidence.id)
	);

	const labelTone = (label) =>
		({ PROSPECT: 'prospect', SPECIALIST: 'specialist', UNKNOWN: 'unknown' })[label] ?? 'neutral';
</script>

<Modal {onclose} width={820} title={name}>
	{#snippet header()}
		<div class="head">
			<Avatar {name} id={candidate?.external_id ?? leadId} size={44} />
			<div class="head-text">
				<h2>{name}</h2>
				<p class="sub">
					{#if snap.bio}{truncate(snap.bio, 110)}{:else}<span class="dim">No bio</span>{/if}
				</p>
			</div>
			{#if candidate}
				<div class="head-badges">
					<Badge tone={labelTone(candidate.label)}>{candidate.label ?? 'unclassified'}</Badge>
					<ConfidenceBar value={candidate.confidence} width={56} />
				</div>
			{/if}
		</div>
	{/snippet}

	{#if loadError}
		<p class="error">Couldn't load this candidate: {loadError}</p>
	{:else if !candidate}
		<p class="loading">Loading…</p>
	{:else}
		<!-- Why the classifier flagged them. Seeing the reasoning is what makes
		     the label trustworthy enough to action from a row. -->
		<section>
			<h3>Classification</h3>
			<div class="panel reasoning">
				{#if candidate.reasoning}
					<p>{candidate.reasoning}</p>
				{:else}
					<p class="dim">No reasoning recorded.</p>
				{/if}
			</div>
		</section>

		{#if evidence}
			<section>
				<h3>Flagging post</h3>
				<article class="panel post">
					<header>
						<h4>{evidence.title || 'Untitled post'}</h4>
						{#if evidence.lead_score != null}
							<Badge tone="warn">lead score {Math.round(evidence.lead_score * 100)}%</Badge>
						{/if}
					</header>
					{#if evidence.body}<p class="body">{evidence.body}</p>{/if}
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
			</section>
		{/if}

		<section>
			<h3>Details</h3>
			<form
				method="POST"
				action="?/save"
				use:enhance={() => {
					saving = true;
					return async ({ update }) => {
						await update({ reset: false, invalidateAll: false });
						saving = false;
						savedAt = Date.now();
					};
				}}
			>
				<input type="hidden" name="leadId" value={candidate.id} />

				<div class="fields">
					<label>
						<span>First name</span>
						<input name="first_name" value={snap.first_name ?? ''} />
					</label>
					<label>
						<span>Last name</span>
						<input name="last_name" value={snap.last_name ?? ''} />
					</label>

					<label class="wide">
						<span>
							LinkedIn URL
							<em>dedupe key — paste the full profile URL</em>
						</span>
						<input
							name="linkedin_url"
							bind:value={linkedinValue}
							placeholder="https://www.linkedin.com/in/…"
						/>
						{#if linkedinValue && slugPreview}
							<small class="hint ok">Will save as <code>{slugPreview}</code></small>
						{:else if linkedinValue}
							<small class="hint bad">Not a recognisable profile URL</small>
						{/if}
					</label>

					<label class="wide">
						<span>Bio / headline</span>
						<textarea name="bio" rows="3">{snap.bio ?? ''}</textarea>
					</label>

					<label>
						<span>Company</span>
						<input name="company" value={snap.company ?? ''} />
					</label>
					<label>
						<span>Location</span>
						<input name="location" value={snap.location ?? ''} />
					</label>
					<label class="wide">
						<span>Website</span>
						<input name="website_url" value={snap.website_url ?? ''} />
					</label>
				</div>

				<div class="save-row">
					<Button type="submit" size="sm" disabled={saving}>
						{saving ? 'Saving…' : 'Save details'}
					</Button>
					{#if savedAt}<span class="saved">Saved</span>{/if}
				</div>
			</form>
		</section>

		<section>
			<h3>Source context</h3>
			<dl class="meta">
				<div>
					<dt>Group role</dt>
					<dd>{snap.role ?? '—'}</dd>
				</div>
				<div>
					<dt>Joined</dt>
					<dd>{snap.joined_at ? fullDate(snap.joined_at) : '—'}</dd>
				</div>
				<div>
					<dt>Skool username</dt>
					<dd>{snap.username ?? '—'}</dd>
				</div>
				<div>
					<dt>Found</dt>
					<dd>{fullDate(candidate.found_at)}</dd>
				</div>
			</dl>

			{#if otherPosts.length}
				<h4 class="sub-head">Other posts ({otherPosts.length})</h4>
				<ul class="posts">
					{#each otherPosts as post}
						<li>
							<span class="post-title">{post.title || 'Untitled'}</span>
							{#if post.is_help_request}<Badge tone="warn">help request</Badge>{/if}
							{#if post.url}
								<a href={post.url} target="_blank" rel="noreferrer noopener" aria-label="Open post">
									<Icon name="link" size={13} />
								</a>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	{#snippet footer()}
		{#if candidate}
			{#if candidate.status === 'accepted'}
				<span class="status-note">Already accepted.</span>
				{#if candidate.prospect_id}
					<Button href="/board/{candidate.prospect_id}" variant="primary" icon="arrowRight">
						Open card
					</Button>
				{/if}
			{:else}
				{#if candidate.status === 'rejected'}
					<span class="status-note">Rejected — accepting promotes it normally.</span>
				{:else}
					<form
						method="POST"
						action="?/reject"
						use:enhance={() =>
							async ({ update }) => {
								await update();
								onclose?.();
							}}
					>
						<input type="hidden" name="leadId" value={candidate.id} />
						<Button variant="danger" type="submit" icon="x">Reject</Button>
					</form>
				{/if}
				<form
					method="POST"
					action="?/accept"
					use:enhance={() =>
						async ({ update }) => {
							await update();
							onclose?.();
						}}
				>
					<input type="hidden" name="leadId" value={candidate.id} />
					<Button variant="primary" type="submit" icon="check">Accept</Button>
				</form>
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
	}

	.head-badges {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: none;
	}

	section + section {
		margin-top: var(--space-5);
	}

	h3 {
		margin-bottom: var(--space-2);
		font-size: var(--text-xs);
		font-weight: var(--weight-semi);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.sub-head {
		margin: var(--space-4) 0 var(--space-2);
		font-size: var(--text-sm);
		font-weight: var(--weight-semi);
		color: var(--text-secondary);
	}

	.panel {
		padding: var(--space-4);
		border-radius: var(--radius-md);
		background: var(--bg-column);
		font-size: var(--text-base);
	}

	.reasoning p {
		line-height: 1.55;
	}

	.post {
		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--space-3);
			margin-bottom: var(--space-2);
		}

		h4 {
			font-size: var(--text-lg);
			font-weight: var(--weight-semi);
		}

		.body {
			white-space: pre-wrap;
			line-height: 1.55;
			color: var(--text-primary);
		}

		footer {
			display: flex;
			align-items: center;
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

				&:hover {
					text-decoration: underline;
				}
			}
		}
	}

	.post-reasoning {
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border-subtle);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.fields {
		display: grid;
		/* minmax(0, …) rather than plain 1fr: a track's default minimum is
		   min-content, which a long pasted URL pushes past the viewport. */
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);
	}

	@media (max-width: 720px) {
		.fields {
			grid-template-columns: minmax(0, 1fr);
		}

		.head {
			flex-wrap: wrap;
		}

		.head-badges {
			flex-basis: 100%;
		}

		h2 {
			font-size: var(--text-lg);
		}

		input,
		textarea {
			/* 16px stops iOS Safari zooming the viewport on focus. */
			font-size: 16px;
		}

		.post .body {
			word-break: break-word;
		}
	}

	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);

		&.wide {
			grid-column: 1 / -1;
		}

		> span {
			display: flex;
			align-items: baseline;
			gap: var(--space-2);
			font-size: var(--text-sm);
			font-weight: var(--weight-medium);
			color: var(--text-secondary);
		}

		em {
			font-style: normal;
			font-size: var(--text-xs);
			color: var(--text-muted);
		}
	}

	input,
	textarea {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border-input);
		border-radius: var(--radius-md);
		background: #ffffff;
		font-size: var(--text-base);
		resize: vertical;
		transition: border-color var(--transition);

		&:focus {
			outline: none;
			border-color: var(--accent);
		}
	}

	.hint {
		font-size: var(--text-xs);

		&.ok {
			color: var(--accent-text);
		}

		&.bad {
			color: var(--reject);
		}

		code {
			font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		}
	}

	.save-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-3);
	}

	.saved {
		font-size: var(--text-sm);
		color: var(--accent-text);
	}

	.meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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

	.status-note {
		margin-right: auto;
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.loading,
	.error {
		padding: var(--space-6);
		text-align: center;
		color: var(--text-muted);
	}

	.error {
		color: var(--reject);
	}

	.dim {
		color: var(--text-muted);
	}
</style>
