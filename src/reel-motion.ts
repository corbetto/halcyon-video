// Exact exponential integration keeps acceleration and braking consistent at
// different render rates. Distances are feet; angles are radians.
export function dampedStep(velocity: number, target: number, dt: number, response = 5, out = { velocity: 0, distance: 0 }) {
  const decay = Math.exp(-response * dt);
  out.velocity = target + (velocity - target) * decay;
  out.distance = target * dt + (velocity - target) * (1 - decay) / response;
  return out;
}
export function stickValue(value: number, deadzone = 0.15): number {
  return Math.abs(value) <= deadzone ? 0 :
    Math.sign(value) * Math.min(1, (Math.abs(value) - deadzone) / (1 - deadzone));
}
