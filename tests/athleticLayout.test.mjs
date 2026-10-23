import test from 'node:test';
import assert from 'node:assert/strict';
import { athleticLayout } from '../src/utils/athleticLayout.js';

test('oval is schematic without sufficient geometry, regardless of lap length', () => {
  const model = athleticLayout({ laneQuantity: 8, laneWidth: 1.22, lengthPerimeter: 400 });
  assert.equal(model.kind, 'oval');
  assert.equal(model.scaled, false);
  assert.equal(model.bandWidth, 9.76);
  assert.equal(athleticLayout({}, { Lanes: 6, 'Lane Width': 1.22 }).lanes, 6);
});
test('entered oval dimensions control proportional geometry without mutating quantities', () => {
  const config = { laneQuantity: 8, laneWidth: 1.22, diagramStraightLength: 85, diagramInnerRadius: 35, quotedSurfaceArea: 6600 };
  const original = JSON.stringify(config);
  const model = athleticLayout(config);
  assert.equal(model.scaled, true);
  assert.equal(model.height, 89.52);
  assert.ok(Math.abs(model.width - 174.52) < 1e-9);
  assert.ok(model.trackArea > 0);
  assert.equal(JSON.stringify(config), original);
  assert.ok(athleticLayout({ ...config, laneQuantity: 6 }).width < model.width);
});
test('rectangle uses length and breadth, not track perimeter assumptions', () => {
  const model = athleticLayout({ areaMethod: 'Length \u00d7 breadth', lengthPerimeter: 100, breadth: 65 });
  assert.equal(model.kind, 'rectangle');
  assert.equal(model.footprintArea, 6500);
});
test('invalid, incomplete and excessive dimensions are handled without broken geometry', () => {
  for (const patch of [{ laneQuantity: 0 }, { laneQuantity: 1.5 }, { laneQuantity: 17 }, { laneWidth: -1 }, { diagramStraightLength: 90 }, { diagramInnerRadius: Infinity }]) {
    assert.equal(athleticLayout({ laneQuantity: 8, laneWidth: 1.22, ...patch }).kind, 'empty');
  }
  assert.equal(athleticLayout({ areaMethod: 'Length \u00d7 breadth', lengthPerimeter: 100, breadth: '' }).kind, 'empty');
});
