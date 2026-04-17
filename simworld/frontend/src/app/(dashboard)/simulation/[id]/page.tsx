import SimulationClient from "./SimulationClient";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function SimulationPage() {
  return <SimulationClient />;
}
