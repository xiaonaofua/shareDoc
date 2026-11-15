import ProgressOverlay from "@/app/ui/Progress";
import { getT } from "@/lib/i18n-server";

/** 打开文件 / 文件夹时，在屏幕中间显示进度条 */
export default async function Loading() {
  const { t } = await getT();
  return <ProgressOverlay label={t("opening")} />;
}
