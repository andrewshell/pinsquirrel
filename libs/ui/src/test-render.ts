import type { HtmlEscapedString } from 'hono/utils/html'

/**
 * Renders a component to the markup a server would send. hono/jsx nodes
 * stringify lazily and a component may resolve asynchronously, so the node is
 * awaited before it is stringified.
 */
export async function render(
  node: HtmlEscapedString | Promise<HtmlEscapedString>
): Promise<string> {
  return (await node).toString()
}
