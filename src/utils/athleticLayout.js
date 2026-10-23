const positive = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export const TRACK_DRAWING_REFERENCE = {
  label: 'Supplied 400 m / 8-lane drawing',
  diagramStraightLength: 84.39, diagramInnerRadius: 36.5,
  referenceLanes: 8, referenceLaneWidth: 1.22, quotedArea: 6600, greenArea: 8087,
};

export function athleticLayout(config = {}, preset = {}) {
  const rectangular = config.areaMethod === 'Length \u00d7 breadth' || config.preset === 'Rectangular/custom facility';
  if (rectangular) {
    const length = positive(config.lengthPerimeter);
    const breadth = positive(config.breadth);
    return length && breadth
      ? { kind: 'rectangle', scaled: true, width: length, height: breadth, footprintArea: length * breadth }
      : { kind: 'empty', message: 'Length and breadth are required for the rectangular plan.' };
  }
  const lanes = positive(config.laneQuantity === '' || config.laneQuantity === undefined ? preset.Lanes : config.laneQuantity);
  const laneWidth = positive(config.laneWidth === '' || config.laneWidth === undefined ? preset['Lane Width'] : config.laneWidth);
  if (!Number.isInteger(lanes) || lanes > 16 || !laneWidth) return { kind: 'empty', message: 'A lane count from 1 to 16 and a positive lane width are required.' };
  const straight = positive(config.diagramStraightLength);
  const radius = positive(config.diagramInnerRadius);
  const hasGeometry = String(config.diagramStraightLength ?? '').trim() || String(config.diagramInnerRadius ?? '').trim();
  if (hasGeometry && (!straight || !radius)) return { kind: 'empty', message: 'Both a positive straight length and inner bend radius are required for a proportional oval.' };
  const scaled = Boolean(straight && radius);
  const innerRadius = radius || 35;
  const straightLength = straight || 85;
  const outerRadius = innerRadius + lanes * laneWidth;
  return {
    kind: 'oval', scaled, lanes, laneWidth, innerRadius, straightLength,
    width: straightLength + 2 * outerRadius, height: 2 * outerRadius,
    bandWidth: lanes * laneWidth,
    trackArea: 2 * straightLength * (outerRadius - innerRadius) + Math.PI * (outerRadius ** 2 - innerRadius ** 2),
  };
}
