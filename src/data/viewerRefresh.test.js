import {
    createViewerRefreshController,
    getViewerTabFromNotification,
    VIEWER_RESUME_THRESHOLD_MS,
    VIEWER_TAB_REFRESH_TTL_MS,
} from './viewerRefresh';

test('tab refresh honors TTL and reselect force bypasses it', async () => {
    let time = 100_000;
    const loader = jest.fn(() => Promise.resolve());
    const controller = createViewerRefreshController({ getContext: () => ({}), loader, now: () => time });
    await controller.refreshHome();
    await controller.refreshHome();
    expect(loader).toHaveBeenCalledTimes(1);
    await controller.refreshHome({ force: true });
    expect(loader).toHaveBeenCalledTimes(2);
    time += VIEWER_TAB_REFRESH_TTL_MS + 1;
    await controller.refreshHome();
    expect(loader).toHaveBeenCalledTimes(3);
});

test('refresh passes only setters needed by the selected tab', async () => {
    const loader = jest.fn(() => Promise.resolve());
    const setters = { setAnnouncements: jest.fn(), setGrades: jest.fn(), setClinicLogs: jest.fn() };
    const controller = createViewerRefreshController({ getContext: () => setters, loader });
    await controller.refreshBoard();
    expect(loader.mock.calls[0][0]).toEqual(expect.objectContaining({
        dataGroups: ['announcements'],
        setAnnouncements: setters.setAnnouncements,
    }));
    expect(loader.mock.calls[0][0].setGrades).toBeUndefined();
});

test('realtime messenger does not invoke the one-shot loader', async () => {
    const loader = jest.fn(() => Promise.resolve());
    const controller = createViewerRefreshController({ getContext: () => ({}), loader });
    await controller.refreshMessenger({ force: true });
    expect(loader).not.toHaveBeenCalled();
    expect(VIEWER_RESUME_THRESHOLD_MS).toBe(30_000);
});

test('notification collections map to their owning tabs', () => {
    expect(getViewerTabFromNotification({ refCollection: 'homeworkAssignments' })).toBe('learning');
    expect(getViewerTabFromNotification({ refCollection: 'announcements' })).toBe('board');
    expect(getViewerTabFromNotification({ refCollection: 'chatRooms' })).toBe('messenger');
});
