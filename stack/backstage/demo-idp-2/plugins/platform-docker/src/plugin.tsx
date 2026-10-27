import { createFrontendPlugin } from "@backstage/frontend-plugin-api";
import { EntityContentBlueprint } from "@backstage/plugin-catalog-react/alpha";
import { DockerImagesContent } from "./components/DockerImagesContent";

const dockerImagesContent = EntityContentBlueprint.make({
  name: "images",
  params: {
    path: "/images",
    title: "Images",
    group: "development",
    filter: "kind:component",
    loader: async () => <DockerImagesContent />,
  },
});

export const dockerPlugin: ReturnType<typeof createFrontendPlugin> =
  createFrontendPlugin({
    pluginId: "docker",
    extensions: [dockerImagesContent],
  });
