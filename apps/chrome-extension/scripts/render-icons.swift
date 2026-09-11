// Renders icons/acorn.svg to the 48 and 128 PNGs, with a transparent
// background. The 16 is not rendered: at that size the vector goes muddy and
// the site's hand-tuned favicon reads better, so icon16.png stays a copy of
// it. macOS only: it leans on AppKit's SVG support so the repo carries no
// rasterizer dependency for a file that changes rarely.
//
//   swift apps/chrome-extension/scripts/render-icons.swift
import AppKit

let root = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent().deletingLastPathComponent()
let svg = root.appendingPathComponent("icons/acorn.svg")
guard let image = NSImage(contentsOf: svg) else { fatalError("cannot read \(svg.path)") }

for size in [48, 128] {
  guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else { fatalError("rep") }
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  NSGraphicsContext.current?.imageInterpolation = .high
  image.draw(in: NSRect(x: 0, y: 0, width: size, height: size), from: .zero, operation: .sourceOver, fraction: 1)
  NSGraphicsContext.restoreGraphicsState()
  let out = root.appendingPathComponent("icons/icon\(size).png")
  try! rep.representation(using: .png, properties: [:])!.write(to: out)
  print("wrote \(out.path)")
}
