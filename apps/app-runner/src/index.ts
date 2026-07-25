import env from "./env";
import app from "./server";

app.listen(env.APP_PORT, () => {
  console.log(`Server running on ${env.APP_PORT}`);
});
