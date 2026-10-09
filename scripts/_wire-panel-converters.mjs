// Wire the 19 simple UnitConverterPanel-based measurement tools to i18n.
// Each file is structurally identical: UnitConverterPanel with title,
// description, optional value-placeholder props.
import fs from 'node:fs';
import path from 'node:path';

const tools = {
  SpeedConverter: 'speed-converter',
  TimeUnitConverter: 'time-unit-converter',
  WeightConverter: 'weight-converter',
  VolumeConverter: 'volume-converter',
  AreaConverter: 'area-converter',
  PressureConverter: 'pressure-converter',
  EnergyConverter: 'energy-converter',
  AngleConverter: 'angle-converter',
  FrequencyConverter: 'frequency-converter',
  ForceConverter: 'force-converter',
  PowerConverter: 'power-converter',
  TorqueConverter: 'torque-converter',
  DensityConverter: 'density-converter',
  AccelerationConverter: 'acceleration-converter',
  FlowRateConverter: 'flow-rate-converter',
  ViscosityConverter: 'viscosity-converter',
  RadiationConverter: 'radiation-converter',
  IlluminanceConverter: 'illuminance-converter',
  CookingConverter: 'cooking-converter',
};

const root = './packages/frontend/src/tools';
let ok = 0;
for (const [dir, slug] of Object.entries(tools)) {
  const file = path.join(root, dir, `${dir}.vue`);
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;

  // 1. import useI18n before the UnitConverterPanel import
  src = src.replace(
    "import UnitConverterPanel from '@/components/UnitConverterPanel.vue';",
    "import { useI18n } from 'vue-i18n';\nimport UnitConverterPanel from '@/components/UnitConverterPanel.vue';",
  );

  // 2. t + U before the composable destructure
  src = src.replace(
    /\nconst \{\n/,
    `\nconst { t } = useI18n();\nconst U = 'tools.${slug}.ui.';\n\nconst {\n`,
  );

  // 3. props
  src = src.replace(/    title="[^"]*"\n/, '    :title="t(U + \'inputTitle\')"\n');
  src = src.replace(
    /    description="[^"]*"\n/,
    '    :description="t(U + \'desc\')"\n',
  );
  if (src.includes('value-placeholder=')) {
    src = src.replace(
      /    value-placeholder="[^"]*"\n/,
      '    :value-placeholder="t(U + \'phValue\')"\n',
    );
  } else {
    src = src.replace(
      '    :results="results"\n',
      '    :results="results"\n    :value-placeholder="t(U + \'phValue\')"\n',
    );
  }

  if (src === orig) {
    console.log(`NO CHANGE ${dir}`);
    continue;
  }
  fs.writeFileSync(file, src);
  ok++;
}
console.log(`${ok} files wired`);
