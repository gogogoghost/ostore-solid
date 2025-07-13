import { createSignal, Match, onCleanup, onMount, Switch } from "solid-js";
import Tab from "../components/Tab";
import Title from "../components/Title";
import { useLocation } from "@solidjs/router";
import ServerList from "../views/ServerList";
import Installed from "../views/Installed";
import Manual from "../views/Manual";
import About from "../views/About";
import { register, unregister } from "../libs/KeyEventManager";
import { createPersistenceSignal } from "../libs/Signal";



export default () => {

    const [tabIndex, setTabIndex] = createPersistenceSignal(0, 'index-tab')

    return (
        <div class="flex flex-col h-full">
            <Title />
            <Tab current={tabIndex()} onIndexChange={setTabIndex}></Tab>
            <Switch>
                <Match when={tabIndex() == 0}>
                    <ServerList all={false} />
                </Match>
                <Match when={tabIndex() == 1}>
                    <ServerList all={true} />
                </Match>
                <Match when={tabIndex() == 2}>
                    <Installed />
                </Match>
                <Match when={tabIndex() == 3}>
                    <Manual />
                </Match>
                <Match when={tabIndex() == 4}>
                    <About />
                </Match>
            </Switch>
        </div >
    );
};