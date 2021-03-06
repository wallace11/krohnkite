// Copyright (c) 2018 Eon S. Jeon <esjeon@hyunmu.am>
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL
// THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

class KWinDriver {
    private engine: TilingEngine;

    constructor() {
        this.engine =  new TilingEngine(this);
    }

    /*
     * Main
     */

    public main() {
        this.loadRules();
        this.bindEvents();
        this.bindShortcut();

        this.onNumberScreensChanged(workspace.numScreens);

        const clients = workspace.clientList();
        for (let i = 0; i < clients.length; i++)
            this.onClientAdded(clients[i]);
    }

    /*
     * Utils
     */

    public getWorkingArea(screenId: number): Rect {
        // TODO: verify: can each desktops have a different placement area?
        return Rect.from(
            workspace.clientArea(KWin.PlacementArea, screenId, workspace.currentDesktop),
        );
    }

    public getClientClassName(client: KWin.Client): string {
        return String(client.resourceClass);
    }

    public getClientGeometry(client: KWin.Client): Rect {
        return new Rect(
            client.geometry.x,
            client.geometry.y,
            client.geometry.width,
            client.geometry.height);
    }

    public setClientGeometry(client: KWin.Client, geometry: Rect) {
        client.geometry.height = geometry.height;
        client.geometry.width = geometry.width;
        client.geometry.x = geometry.x;
        client.geometry.y = geometry.y;
    }

    public isClientVisible(client: KWin.Client, screenId: number): boolean {
        // TODO: test KWin::Toplevel properties...?
        return (
            (!client.minimized) &&
            (client.desktop === workspace.currentDesktop
                || client.desktop === -1 /* on all desktop */) &&
            (client.activities.length === 0 /* on all activities */
                || client.activities.indexOf(workspace.currentActivity) !== -1) &&
            (client.screen === screenId)
        );
    }

    public isClientFullScreen(client: KWin.Client): boolean {
        return client.fullScreen;
    }

    public getActiveClient(): KWin.Client {
        return workspace.activeClient;
    }

    public setActiveClient(client: KWin.Client) {
        workspace.activeClient = client;
    }

    /*
     * Config
     */

    private loadRules() {
        // TODO: configurable rules
        this.engine.updateRules([
            new Rule("krunner", true, false),
        ]);
    }

    /*
     * Shortcut
     */

    private bindShortcut() {
        if (!KWin.registerShortcut) return;

        const bind = (seq: string, title: string, input: UserInput) => {
            title = "Krohnkite: " + title;
            seq = "Meta+" + seq;
            const cb = () => { this.engine.handleUserInput(input); };
            KWin.registerShortcut(title, "", seq, cb);
        };

        bind("J", "Down/Next", UserInput.Down);
        bind("K", "Up/Prev"  , UserInput.Up);
        bind("H", "Left"     , UserInput.Left);
        bind("L", "Right"    , UserInput.Right);

        bind("Shift+J", "Move Down/Next", UserInput.ShiftDown);
        bind("Shift+K", "Move Up/Prev"  , UserInput.ShiftUp);
        bind("Shift+H", "Move Left"     , UserInput.ShiftLeft);
        bind("Shift+L", "Move Right"    , UserInput.ShiftRight);

        bind("I", "Increase", UserInput.Increase);
        bind("D", "Decrease", UserInput.Decrease);
        bind("F", "Float", UserInput.Float);
        bind("\\", "Cycle Layout", UserInput.CycleLayout);

        bind("Return", "Set master", UserInput.SetMaster);
    }

    /*
     * Signal handlers
     */

    private bindEvents() {
        workspace.clientAdded.connect(this.onClientAdded);
        workspace.clientFullScreenSet.connect(this.engine.arrange);
        workspace.clientMinimized.connect(this.engine.arrange);
        workspace.clientRemoved.connect(this.onClientRemoved);
        workspace.clientUnminimized.connect(this.engine.arrange);
        workspace.currentDesktopChanged.connect(this.engine.arrange);
        workspace.numberScreensChanged.connect(this.onNumberScreensChanged);
        workspace.screenResized.connect(this.engine.arrange);
        workspace.currentActivityChanged.connect(this.engine.arrange);
    }

    private onClientAdded = (client: KWin.Client) => {
        if (client.specialWindow) return;
        if (String(client.resourceClass) === "plasmashell") return;

        debug(() => "onClientAdded: '" + client.caption + "' class=" + client.resourceClass);

        if (this.engine.manageClient(client)) {
            client.desktopChanged.connect(this.engine.arrange);
            client.geometryChanged.connect(() => {
                if (client.move || client.resize) return;
                this.engine.arrangeClient(client);
            });
            client.moveResizedChanged.connect(() => {
                if (client.move || client.resize) return;
                this.engine.setClientFloat(client, true, client.geometry);
                this.engine.arrange();
            });
        }
    }

    private onClientRemoved = (client: KWin.Client) => {
        debug(() => "onClientRemoved: '" + client.caption + "'");
        /* XXX: This is merely an attempt to remove the exited client.
         * Sometimes, the client is not found in the tile list, and causes an
         * exception in `engine.arrange`. */
        this.engine.unmanageClient(client);
    }

    private onNumberScreensChanged = (count: number) => {
        while (this.engine.screens.length < count)
            this.engine.addScreen(this.engine.screens.length);
        while (this.engine.screens.length > count)
            this.engine.removeScreen(this.engine.screens.length - 1);
    }
}
