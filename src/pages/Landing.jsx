import Card from "../components/Card";
import TopBar from "../components/TopBar";
import { lsGet } from "../lib/storage";
import { PROJECTS_KEY } from "../data/seed";
import { computeStats } from "../lib/scoring";

export default function Landing() {
  const projects = lsGet(PROJECTS_KEY, []);
  const ranked = computeStats(projects);

  return (
    <>
      <TopBar />
      <div className="p-6 grid grid-cols-3 gap-4">
        {ranked.map((h, i) => (
          <Card key={h.head}>
            <h3 className="font-semibold">{h.head}</h3>
            <p className="text-3xl font-bold mt-2">{h.score}</p>
            <p className="text-sm mt-1">
              Done: {h.done} | Blocked: {h.blocked}
            </p>
            <p className="text-xs mt-2">
              {i === 0 ? "🏆 Leader" : i === 1 ? "🥈 Chasing" : "🔥 Comeback"}
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}
