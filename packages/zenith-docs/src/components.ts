import Accordion from './components/Accordion.astro';
import Accordions from './components/Accordions.astro';
import Callout from './components/Callout.astro';
import Card from './components/Card.astro';
import Cards from './components/Cards.astro';
import File from './components/File.astro';
import Files from './components/Files.astro';
import Folder from './components/Folder.astro';
import Icon from './components/Icon.astro';
import Step from './components/Step.astro';
import Steps from './components/Steps.astro';
import Tab from './components/Tab.astro';
import Tabs from './components/Tabs.astro';

export { Accordion, Accordions, Callout, Card, Cards, File, Files, Folder, Icon, Step, Steps, Tab, Tabs };

/** Components available in MDX pages without importing them. */
export const mdxComponents = {
  Accordion,
  Accordions,
  Callout,
  Card,
  Cards,
  File,
  Files,
  Folder,
  Step,
  Steps,
  Tab,
  Tabs,
};
