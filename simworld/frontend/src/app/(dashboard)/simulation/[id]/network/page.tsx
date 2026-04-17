import NetworkClient from "./NetworkClient";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function NetworkPage() {
  return <NetworkClient />;
}
