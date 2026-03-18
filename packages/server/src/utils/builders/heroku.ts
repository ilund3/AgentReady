import { prepareEnvironmentVariablesForShell } from "../docker/utils";
import { getBuildAppDirectory } from "../filesystem/directory";
import type { ApplicationNested } from ".";

export const getHerokuCommand = (application: ApplicationNested) => {
	const { env, appName, cleanCache } = application;

	const buildAppDirectory = getBuildAppDirectory(application);
	const envVariables = prepareEnvironmentVariablesForShell(
		env,
		application.environment.project.env,
		application.environment.env,
	);

	const args = [
		"build",
		appName,
		"--path",
		buildAppDirectory,
		"--builder",
		`heroku/builder:${application.herokuVersion || "24"}`,
	];

	if (cleanCache) {
		args.push("--clear-cache");
	}

	for (const env of envVariables) {
		args.push("--env", env);
	}

	const command = `pack ${args.join(" ")}`;
	const bashCommand = `
echo "Starting heroku build..." ;
${command} || { 
  echo "[FAILED] Heroku build failed" ;
  exit 1;
}
echo "[OK] Heroku build completed." ;
		`;

	return bashCommand;
};
