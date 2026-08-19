# Effect Size Converter

A pocket-reference web tool for converting between the effect measures a paper reports and the one your meta-analysis needs: **control event rate (CER)**, **experimental event rate (EER)**, **risk ratio (RR)**, **odds ratio (OR)** and the **standardised mean difference (SMD, Cohen's d)**.

Conversions among CER, EER, RR and OR are exact algebra. Conversions that cross the dichotomous/continuous boundary — anything to or from an SMD — rest on a latent-variable assumption, which is stated on every result card rather than buried in a footnote.

Built to sit open in a browser tab alongside Covidence / Excel during SR&MA data extraction. It replaces five retired WordPress "Calculated Fields Form" widgets, whose outputs are pinned by `tests/legacy.test.ts`.

**Live tool:** <https://ykfrkw.github.io/es-calculator/>

## Methods

### Exact (no assumption)

| # | Rule id | Inputs | Formula |
| :- | :- | :- | :- |
| 1 | `rr_from_rates` | CER, EER | `RR = EER / CER` |
| 2 | `or_from_rates` | CER, EER | `OR = EER(1 − CER) / (CER(1 − EER))` |
| 3 | `eer_from_cer_or` | CER, OR | `EER = expit(logit(CER) + ln OR)` |
| 4 | `eer_from_cer_rr` | CER, RR | `EER = RR × CER` |
| 5 | `cer_from_eer_rr` | EER, RR | `CER = EER / RR` |
| 6 | `cer_from_eer_or` | EER, OR | `CER = EER / ((1 − EER)·OR + EER)` |
| 7 | `cer_from_or_rr` | OR, RR | `CER = (OR − RR) / (RR·(OR − 1))` |

Rule 3 is written through the logit rather than as the algebraically equivalent `OR·CER / (1 − CER + OR·CER)`, which cancels badly as CER approaches 1.

Rule 7 is guarded. As OR → 1 the numerator and denominator both vanish, so the expression returns float noise instead of an answer. Inside a 1e-9 band the tool answers from the algebra:

- OR = 1 and RR = 1 — **indeterminate**: every CER in (0, 1) is consistent with "no difference", so nothing can be recovered.
- OR = 1, RR ≠ 1 — **inconsistent**: equal odds force equal risks.
- RR = 1, OR ≠ 1 — **inconsistent**: equal risks force equal odds. The algebra formally yields CER = 1, a boundary rather than an answer, and the tool refuses to return it.
- Result outside (0, 1) — **incompatible**: an odds ratio is always further from 1 than the corresponding risk ratio, so the pair does not describe any pair of event rates.

Rules 4 and 5 reject an implied event rate of 1 or more, and report the largest risk ratio the given rate allows.

### Approximate (OR ↔ SMD)

| # | Method id | Inputs | To SMD | From SMD | Assumption |
| :- | :- | :- | :- | :- | :- |
| 8 | `cox` | OR | `d = ln(OR) / 1.65` | `OR = exp(1.65 × d)` | Logistic latent variable |
| 9 | `hh` | OR | `d = ln(OR) / 1.81` | `OR = exp(1.81 × d)` | Logistic latent variable; 1.81 ≈ π/√3, the SD of the standard logistic |

`1.65` and `1.81` are literal constants, not `Math.PI / Math.sqrt(3)` rounded. Chinn's published method is stated with 1.81, and meta-analyses report values computed with 1.81; substituting the exact logistic SD (1.8138) shifts every converted effect size by about 0.2 %. Both constants are locked by tests.

Both methods are a function of the odds ratio alone, so a set of inputs that does not determine an odds ratio leaves them blocked. The tool shows the route greyed out and names the input that would unblock it rather than hiding the method.

Running an SMD backwards, both methods seed **OR**; feeding that back through the exact rules recovers the rates and the risk ratio for free.

## What it does not do

- No risk difference, NNT, absolute or relative risk reduction.
- No standard errors and no confidence intervals. These conversions transform a point estimate, not its uncertainty; to pool converted effect sizes you must also convert the standard error, which this tool does not do.
- No charts.

## Sign convention

An event that is more likely in the experimental arm gives a positive *d*. If the event is a harm, a positive *d* is the worse result. If the odds ratio came from dichotomising a continuous scale, the sign depends on which direction was counted as response. Nothing in the arithmetic can detect a sign error, so check it against the source paper.

## Using it

Pick **one** measure to convert from and **one** to convert to: **Event rates**, **RR**, **OR** or **SMD**. Event rates is a single choice covering CER and EER, because either arm's rate answers the same question and separating them offered combinations that never arise. Anything else the conversion needs is then prompted for as a field rather than expressed in the picker.

Because any two of CER, EER, RR and OR determine all four, a conversion between two ratios asks for one binary more — `OR → RR` shows an **"Also needed"** block asking for CER, and filling it is enough. The tool never asks for EER: CER is the rate a paper always reports, so demanding the experimental arm's rate would only make the form look arbitrary.

Until the requirement is met the result area names what is missing instead of showing a number.

Results are shown to two decimal places, lines of working included, so a value never appears with two different roundings on the same screen. A number that two decimals would flatten to `0.00` is shown to two significant figures instead, and anything outside `[0.001, 1000)` switches to exponential notation.

## Deep links

The picker state lives in the query string: `?from=or&to=rr`, with optional numeric prefills (`&or=2.15&cer=0.2`) that satisfy the "Also needed" block on load. The tokens are `rates`, `rr`, `or` and `smd`. The five presets the blog post links to are:

`?from=or&to=rates` · `?from=or&to=rr` · `?from=rr&to=or` · `?from=or&to=smd` · `?from=smd&to=or`

Links minted against earlier revisions still work. `from` was a comma-separated list: the first valid id wins and the rest are dropped silently. `cer` and `eer` were separate sides of the picker: either now maps onto `rates`, and `?from=cer&to=eer` — whose two sides collapse onto the same selection — lands on `OR → Event rates` with its prefills intact. Unknown ids are dropped and a self-contradictory link falls back to the default state, so a stale link never renders an error. The tool writes the URL back with `history.replaceState` only, so an embedded copy cannot hijack the reader's Back button.

## References

- Cox DR. *Analysis of Binary Data.* London: Methuen; 1970. (2nd ed.: Cox DR, Snell EJ. Chapman & Hall; 1989.)
- Hasselblad V, Hedges LV. Meta-analysis of screening and diagnostic tests. *Psychol Bull.* 1995;117(1):167–178. doi:10.1037/0033-2909.117.1.167. PMID: [7870860](https://pubmed.ncbi.nlm.nih.gov/7870860/). The logistic-scale conversion, popularised for meta-analysis by Chinn 2000.
- Chinn S. A simple method for converting an odds ratio to effect size for use in meta-analysis. *Stat Med.* 2000;19(22):3127–3131. doi:10.1002/1097-0258(20001130)19:22\<3127::aid-sim784\>3.0.co;2-m. PMID: [11113947](https://pubmed.ncbi.nlm.nih.gov/11113947/).
- Sánchez-Meca J, Marín-Martínez F, Chacón-Moscoso S. Effect-size indices for dichotomized outcomes in meta-analysis. *Psychol Methods.* 2003;8(4):448–467. doi:10.1037/1082-989X.8.4.448. PMID: [14664682](https://pubmed.ncbi.nlm.nih.gov/14664682/). A study comparing seven effect-size indices for dichotomised outcomes.

## Disclaimer

Every conversion that crosses between a dichotomous and a continuous scale is an approximation resting on an assumption the data cannot check. Where a trial reports the measure you need, use the reported measure. Where it does not, report which conversion you used and treat the spread between methods — which the tool shows whenever two or more resolve — as part of the uncertainty. The tool does not replace judgement; it saves arithmetic.

## Development

```bash
npm install
npm run lint    # eslint
npm test        # vitest unit tests
npm run dev     # Vite dev server at http://localhost:5173/
npm run build   # type-check + production bundle in dist/
npm run preview
```

All conversion logic lives in `src/lib/es/**`. `vitest.config.ts` collects only `tests/**/*.test.ts` under `environment: 'node'`, so nothing testable belongs in a `.tsx` file.

`tests/legacy.test.ts` is the gate on retiring the WordPress plugin: one describe block per retired widget. If it fails, the plugin still has a job.

## Deployment

`.github/workflows/deploy.yml` lints, tests, builds and publishes `dist/` to GitHub Pages on every push to `main`.

Vite's `base` is `'./'`, not `/es-calculator/`. Relative asset paths let the same build work at the Pages URL, inside an iframe embed and from `file://` alike — do not change it to an absolute path without checking the blog embed.

## License

MIT
