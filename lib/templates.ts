import {
  STATIC_TEMPLATE,
  DYNAMIC_TEMPLATE,
  DYNAMIC2_TEMPLATE,
} from "./templatesData";

/**
 * The three AMPscript template clusters, treated as OBJECTS that get
 * called when the build type is established (SPEC, template selection).
 * Their contents are uneditable — see /templates for the source files.
 */

export type BuildType = "static" | "dynamic";
/** Dynamic sub-variant: one shared subject/preheader, or one per keycode. */
export type DynamicVariant = "single" | "multi";

export interface TemplateCluster {
  id: string;
  fileName: string;
  buildType: BuildType;
  variant?: DynamicVariant;
  label: string;
  source: string;
}

export const TEMPLATE_CLUSTERS: TemplateCluster[] = [
  {
    id: "static",
    fileName: "ampscript_file.html",
    buildType: "static",
    label: "Static template",
    source: STATIC_TEMPLATE,
  },
  {
    id: "dynamic-single",
    fileName: "ampscript-file-dynamic.html",
    buildType: "dynamic",
    variant: "single",
    label: "Dynamic template",
    source: DYNAMIC_TEMPLATE,
  },
  {
    id: "dynamic-multi",
    fileName: "ampscript-file-dynamic-2.html",
    buildType: "dynamic",
    variant: "multi",
    label: "Dynamic template — subject/preheader per keycode",
    source: DYNAMIC2_TEMPLATE,
  },
];

/** Select the cluster object for a build type (+ dynamic variant). */
export function selectTemplate(
  buildType: BuildType,
  variant: DynamicVariant = "single"
): TemplateCluster {
  const found = TEMPLATE_CLUSTERS.find(
    (cluster) =>
      cluster.buildType === buildType &&
      (buildType === "static" || cluster.variant === variant)
  );
  if (!found) throw new Error(`No template cluster for ${buildType}/${variant}`);
  return found;
}
