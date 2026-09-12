import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import VerifyForm from "./VerifyForm";

export default function VerifyPage() {
  const t = getDictionary(getLocale());
  return <VerifyForm t={t.verify} />;
}
