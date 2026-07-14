import PageShell from "@/components/PageShell";
import PageHeader from "@/components/PageHeader";

/** External link with the shared underline treatment + safe rel. */
function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="link">
      {children}
    </a>
  );
}

/** DOI rendered as a resolvable link. */
function Doi({ id }: { id: string }) {
  return (
    <>
      DOI: <A href={`https://doi.org/${id}`}>{id}</A>
    </>
  );
}

function Ref({
  n,
  title,
  license,
  children,
}: {
  n: string;
  title: string;
  license?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 border-t border-hairline py-5 first:border-t-0 first:pt-0">
      <span className="num shrink-0 text-sm text-text-lo">{n}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="display text-xs uppercase tracking-widest text-text-hi">
            {title}
          </h3>
          {license && (
            <span className="num rounded-full border border-hairline px-2 py-0.5 text-[10px] uppercase tracking-widest text-text-lo">
              {license}
            </span>
          )}
        </div>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-text-lo">
          {children}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
        <p className="label !text-text-hi">{label}</p>
      </div>
      <div className="glass rounded-2xl p-6">{children}</div>
    </section>
  );
}

export default function CitationsPage() {
  return (
    <PageShell max="sm">
      <PageHeader
        eyebrow="Attribution"
        title="Citations"
        lede="NeuroVas Copilot is built entirely on public datasets and open-source work. Every source below is credited in accordance with its terms of use — no private or lab data is used anywhere in the project."
      />

      <Section label="Datasets">
        <Ref n="01" title="AneuX morphology database" license="CC BY-NC 4.0">
          <p>
            Morphology fast-path — an open-access, multi-centric database
            combining the{" "}
            <A href="https://www.aneux.ch">AneuX project</A>, the{" "}
            <A href="https://www.aneurist.org">@neurIST project</A>, and{" "}
            <A href="http://ecm2.mathcs.emory.edu/aneuriskweb/index">Aneurisk</A>.
            Provided &ldquo;as is&rdquo; under the{" "}
            <A href="https://creativecommons.org/licenses/by-nc/4.0/">
              CC BY-NC 4.0
            </A>{" "}
            license.
          </p>
          <div className="mt-4 rounded-xl border border-hairline bg-black/20 p-4">
            <p className="num text-[10px] uppercase tracking-widest text-text-lo">
              Required citation
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-hi">
              Juchler N, Schilling S, Bijlenga P, Kurtcuoglu V, Hirsch S.{" "}
              <span className="italic">
                Shape trumps size: image-based morphological analysis reveals
                that the 3D shape discriminates intracranial aneurysm disease
                status better than aneurysm size.
              </span>{" "}
              Frontiers in Neurology (2022). <Doi id="10.3389/fneur.2022.809391" />{" "}
              · Zenodo: <A href="https://doi.org/10.5281/zenodo.6678442">10.5281/zenodo.6678442</A>
            </p>
          </div>
        </Ref>

        <Ref n="02" title="Aneurisk / AneuriskWeb — case C0001">
          <p>
            3D-RA vessel geometry with a precomputed centerline — the hero
            geometry and graph case. Pulled from the{" "}
            <A href="https://github.com/hkjeldsberg/AneuriskDatabase">
              AneuriskDatabase GitHub mirror
            </A>
            , derived from the{" "}
            <A href="http://ecm2.mathcs.emory.edu/aneuriskweb/index">
              AneuriskWeb repository
            </A>
            .
          </p>
          <p>
            Aneurisk-Team.{" "}
            <span className="italic">AneuriskWeb project website.</span> Emory
            University, Dept. of Mathematics &amp; Computer Science (2012).
          </p>
          <p>
            Sangalli LM, Secchi P, Vantini S.{" "}
            <span className="italic">
              AneuRisk65: A dataset of three-dimensional cerebral vascular
              geometries.
            </span>{" "}
            Electronic Journal of Statistics 8(2), 1879–1890 (2014).{" "}
            <Doi id="10.1214/14-EJS938" />
          </p>
        </Ref>

        <Ref
          n="03"
          title="Lausanne TOF-MRA aneurysm cohort"
          license="CC0"
        >
          <p>
            Open TOF-MRA scans with weak aneurysm labels — the reconstruction
            showcase case (HERO_sub013, LAUSANNE_sub000). Dataset:{" "}
            <A href="https://openneuro.org/datasets/ds003949">
              OpenNeuro ds003949
            </A>{" "}
            (<A href="https://doi.org/10.18112/openneuro.ds003949.v1.0.1">10.18112/openneuro.ds003949.v1.0.1</A>).
          </p>
          <p>
            Di Noto T, Marie G, Tourbier S, Alemán-Gómez Y, Esteban O, Saliou
            G, Bach Cuadra M, Hagmann P, Richiardi J.{" "}
            <span className="italic">
              Towards Automated Brain Aneurysm Detection in TOF-MRA: Open Data,
              Weak Labels, and Anatomical Knowledge.
            </span>{" "}
            Neuroinformatics 21, 21–34 (2023).{" "}
            <Doi id="10.1007/s12021-022-09597-0" />
          </p>
        </Ref>

        <Ref
          n="04"
          title="CMHA — intracranial aneurysm CTA dataset"
          license="CC BY-NC-ND 4.0"
        >
          <p>
            The one case with real dataset-computed CFD hemodynamics (WSS / OSI),
            morphometry, and published clinical data (case
            CMHA_AHMU1218001). Attribution is mandatory. Dataset (CMHA):{" "}
            <A href="https://doi.org/10.6084/m9.figshare.26965450">
              figshare 10.6084/m9.figshare.26965450
            </A>
            .
          </p>
          <p>
            Song M, Wang S, Qian Q, Zhou Y, Luo Y, Gong X.{" "}
            <span className="italic">
              Intracranial aneurysm CTA images and 3D models dataset with
              clinical morphological and hemodynamic data.
            </span>{" "}
            Scientific Data 11 (2024).{" "}
            <Doi id="10.1038/s41597-024-04056-8" />
          </p>
        </Ref>
      </Section>

      <Section label="Methods & algorithms">
        <Ref n="05" title="Frangi vesselness — vessel enhancement">
          <p>
            Multiscale vessel enhancement for the TOF-MRA reconstruction path.
          </p>
          <p>
            Frangi AF, Niessen WJ, Vincken KL, Viergever MA.{" "}
            <span className="italic">Multiscale vessel enhancement filtering.</span>{" "}
            MICCAI 1998, LNCS 1496, 130–137. <Doi id="10.1007/BFb0056195" />
          </p>
        </Ref>

        <Ref n="06" title="Marching cubes — surface extraction">
          <p>
            Lorensen WE, Cline HE.{" "}
            <span className="italic">
              Marching cubes: A high resolution 3D surface construction
              algorithm.
            </span>{" "}
            SIGGRAPH Comput. Graph. 21(4), 163–169 (1987).{" "}
            <Doi id="10.1145/37401.37422" />
          </p>
        </Ref>

        <Ref n="07" title="3D skeletonization / medial-axis thinning">
          <p>
            Centerline-graph extraction via medial-surface thinning.
          </p>
          <p>
            Lee TC, Kashyap RL, Chu CN.{" "}
            <span className="italic">
              Building skeleton models via 3-D medial surface/axis thinning
              algorithms.
            </span>{" "}
            CVGIP: Graphical Models and Image Processing 56(6), 462–478 (1994).{" "}
            <Doi id="10.1006/cgip.1994.1042" />
          </p>
        </Ref>

        <Ref n="08" title="Taubin mesh smoothing — shrink-free">
          <p>
            Taubin G.{" "}
            <span className="italic">
              Curve and surface smoothing without shrinkage.
            </span>{" "}
            ICCV 1995, 852–857. <Doi id="10.1109/ICCV.1995.466848" />
          </p>
        </Ref>
      </Section>

      <Section label="Other">
        <Ref n="09" title="Landing 3D visualization">
          <p>
            The animated &ldquo;synapse brain&rdquo; on the landing page is
            adapted from prisoner849&rsquo;s CodePen.{" "}
            <A href="https://codepen.io/prisoner849/pen/RwjQaeO">
              codepen.io/prisoner849/pen/RwjQaeO
            </A>
            .
          </p>
        </Ref>

        <Ref n="10" title="Reasoning agent — Claude, Anthropic">
          <p>
            The agent that reads the patient&rsquo;s numbers, retrieves and
            weighs the literature, and drives the 3D view.{" "}
            Anthropic. <span className="italic">Claude</span> [large language
            model]. <A href="https://www.anthropic.com">anthropic.com</A>
          </p>
        </Ref>
      </Section>
    </PageShell>
  );
}
