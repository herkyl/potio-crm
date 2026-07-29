<script>
	// Renders an <a> when given href, a <button> otherwise, so link-shaped and
	// action-shaped controls stay visually identical.

	import Icon from './Icon.svelte';

	let {
		variant = 'secondary', // primary | secondary | ghost | danger | accept
		size = 'md', // sm | md
		icon = null,
		href = null,
		type = 'button',
		disabled = false,
		title = null,
		// Submits a form elsewhere in the document, for buttons in a modal footer.
		form = null,
		// A submit button that carries its own name/value, so one form can offer
		// several outcomes (Won / Lost / Parked). Both must reach the DOM or the
		// pair is never submitted and the action sees null.
		name = null,
		value = null,
		onclick = null,
		children
	} = $props();
</script>

<svelte:element
	this={href ? 'a' : 'button'}
	class="btn {variant} {size}"
	class:icon-only={icon && !children}
	{href}
	{title}
	form={href ? undefined : form}
	name={href ? undefined : name}
	value={href ? undefined : value}
	type={href ? undefined : type}
	disabled={href ? undefined : disabled}
	aria-disabled={href && disabled ? 'true' : undefined}
	role={href ? 'button' : undefined}
	{onclick}
>
	{#if icon}<Icon name={icon} size={size === 'sm' ? 14 : 16} />{/if}
	{#if children}<span>{@render children()}</span>{/if}
</svelte:element>

<style lang="less">
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		border-radius: var(--radius-lg);
		font-weight: var(--weight-semi);
		white-space: nowrap;
		transition:
			background var(--transition),
			border-color var(--transition),
			color var(--transition),
			box-shadow var(--transition);

		&:disabled,
		&[aria-disabled='true'] {
			opacity: 0.5;
			pointer-events: none;
		}
	}

	.md {
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-base);
		min-height: 38px;
	}

	.sm {
		padding: var(--space-1) var(--space-3);
		font-size: var(--text-sm);
		min-height: 30px;
	}

	.icon-only {
		padding: 0;
		width: 38px;

		&.sm {
			width: 30px;
		}
	}

	.primary {
		background: var(--accent);
		color: #ffffff;

		&:hover {
			background: var(--accent-hover);
		}
	}

	.secondary {
		background: #ffffff;
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);

		&:hover {
			background: var(--bg-hover);
			border-color: var(--border-input);
		}
	}

	.ghost {
		color: var(--text-secondary);

		&:hover {
			background: var(--bg-column);
			color: var(--text-primary);
		}
	}

	/* Accept is the primary action wherever it appears, so it borrows the brand
	   green rather than inventing a second one. SPEC §6.2. */
	.accept {
		background: var(--accept-soft);
		color: var(--accent-text);
		border: 1px solid transparent;

		&:hover {
			background: var(--accept);
			color: #ffffff;
		}
	}

	.danger {
		background: #ffffff;
		border: 1px solid var(--border-subtle);
		color: var(--reject);

		&:hover {
			background: var(--reject-soft);
			border-color: var(--reject-soft);
		}
	}
</style>
