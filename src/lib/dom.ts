// DOM pour le build : Plot a besoin d'un `document` pour produire le SVG (linkedom, jamais envoyé au navigateur)
import { parseHTML } from "linkedom";

export function documentBuild(): Document {
  return parseHTML("<html><body></body></html>").document as unknown as Document;
}
