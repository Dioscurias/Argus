# Argus Map UI Polish Design

## Goal

Improve the visual hierarchy of aircraft on the map, explain layer colors and motion-path styles with a compact persistent legend, and strengthen keyboard accessibility and contrast. Preserve all existing functionality and avoid changes to map data, interaction behavior, or service logic.

## Approaches considered

1. **CSS-only refinements:** lowest implementation risk, but insufficient for a map legend and clearer aircraft symbols.
2. **Presentation-only map polish (recommended):** tune existing symbol presentation and add a responsive legend derived from the existing layer stack. No new application state or controls.
3. **Interactive legend:** add hide/show behavior and UI state. This adds behavior and regression surface without being necessary for the request.

## Design

- Preserve existing aircraft semantics: live aircraft remain blue, delayed aircraft remain muted, and the selected aircraft remains teal. Make the symbol hierarchy modestly clearer through presentation-only styling.
- Add an always-visible map overlay that lists visible layers using their configured colors and explains observed trail (solid), estimated motion (dotted), and route (dashed) line styles.
- Keep the legend compact on small screens without hiding it. Avoid overlap with existing map controls, selection controls, and status information.
- Improve focus indication and contrast for existing map overlays and panels while preserving keyboard and responsive panel behavior.
- Do not add data, service calls, application state, controls, or changes to existing interactions. The legend reflects existing layer visibility; path styles are explained even when no path is currently drawn.

## Architecture and data flow

The map view will render the legend from the existing layer stack. Layer visibility and configured colors remain the source of truth. Motion-path labels are static presentation metadata for the styles already rendered by the aircraft layer renderer. No changes are planned to feed, filtering, selection, movement, or map-navigation logic.

## Accessibility and responsive behavior

Use readable labels in addition to color, provide an accessible name for the legend, preserve visible keyboard focus, and keep the legend persistent and compact at mobile widths. Existing keyboard and panel controls remain unchanged.

## Validation

- Run the production build and typecheck.
- Run the existing automated test suite.
- Run browser checks at desktop and mobile sizes, verifying the legend and existing controls, interactions, and responsive panel behavior.
