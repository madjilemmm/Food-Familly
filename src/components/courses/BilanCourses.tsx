import type { DerniereCourse } from "@/lib/data";
import { listeDeNoms } from "@/lib/domain/convives";
import { Merci } from "./Merci";
import { PartagerSemaine } from "./PartagerSemaine";

/**
 * Après les courses : pour celle ou celui qui les a faites, le bilan (et les mercis reçus) ;
 * pour les autres, « Karin a fait les courses » et un merci d'un appui.
 */
export function BilanCourses({ course, moi }: { course: DerniereCourse; moi: { id: string; name: string } }) {
  const jeLesAiFaites = course.shopper?.id === moi.id;
  if (!course.shopper) return null;
  const merciDeMoi = course.mercis.some((m) => m.id === moi.id);
  return (
    <section aria-label="Les dernières courses" className="kd-monte mb-8 flex flex-col items-start gap-3 rounded-carte bg-blanc p-5 text-aubergine">
      {jeLesAiFaites ? (
        <>
          <p className="kd-titre-3">Courses finies&nbsp;!</p>
          <p className="text-encre">
            {course.pris} article{course.pris > 1 ? "s" : ""} acheté{course.pris > 1 ? "s" : ""}
            {course.pourQui.length > 0 && <> · pour {listeDeNoms(course.pourQui)}</>}.
          </p>
          {course.mercis.length > 0 && (
            <p className="font-semibold text-violet">
              {listeDeNoms(course.mercis.map((m) => m.name))} {course.mercis.length > 1 ? "te disent" : "te dit"} merci.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="kd-titre-3">{course.shopper.name} a fait les courses</p>
          {course.mercis.length > 0 && !merciDeMoi && (
            <p className="kd-petit">{listeDeNoms(course.mercis.map((m) => m.name))} a déjà dit merci.</p>
          )}
          <Merci tripId={course.id} dejaDit={merciDeMoi} />
        </>
      )}
      <PartagerSemaine />
    </section>
  );
}
