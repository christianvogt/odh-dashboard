import * as React from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Content,
  Flex,
  FlexItem,
  Label,
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadMain,
  MastheadToggle,
  Nav,
  NavItem,
  NavList,
  Page,
  PageSection,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
  Tab,
  Tabs,
  TabTitleText,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { BarsIcon, TimesIcon } from '@patternfly/react-icons';
import { EventDetails } from './EventDetails';
import { SegmentPayload } from './SegmentPayload';
import type { RawEvent } from '../controller/types';

type AnalyticsDevToolProps = {
  events: RawEvent[];
  onClose: () => void;
  onClear: () => void;
};

const getEventSummary = (event: RawEvent): string => {
  if (event.type === 'network') {
    try {
      return `${event.request.method} ${new URL(event.request.url).pathname}`;
    } catch {
      return `${event.request.method} ${event.request.url}`;
    }
  }
  const label = event.a11y.name || event.a11y.role || 'interaction';
  return `${event.eventType} • ${label}`;
};

const getEventTime = (event: RawEvent): string =>
  new Date(event.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const getCapturedSummary = (event: RawEvent): string | null => {
  if (!event.capturedEvents || event.capturedEvents.length === 0) {
    return null;
  }
  return event.capturedEvents.map((capture) => capture.eventName).join(', ');
};

const getEventKey = (event: RawEvent): string => event.logId ?? event.id;

export const AnalyticsDevTool: React.FC<AnalyticsDevToolProps> = ({ events, onClose, onClear }) => {
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>('details');
  const [selectedEventKey, setSelectedEventKey] = React.useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | 'captured'>('all');
  const [eventTypeFilter, setEventTypeFilter] = React.useState<'all' | 'interaction' | 'network'>(
    'all',
  );
  const [followLatest, setFollowLatest] = React.useState(false);
  const prevEventsLengthRef = React.useRef(events.length);

  const filteredEvents = React.useMemo(() => {
    return events.filter((event) => {
      if (filter === 'captured' && (event.capturedEvents?.length ?? 0) === 0) {
        return false;
      }
      if (eventTypeFilter !== 'all' && event.type !== eventTypeFilter) {
        return false;
      }
      return true;
    });
  }, [events, filter, eventTypeFilter]);

  const selectedEvent = React.useMemo(
    () => filteredEvents.find((event) => getEventKey(event) === selectedEventKey) ?? null,
    [filteredEvents, selectedEventKey],
  );

  React.useEffect(() => {
    const newEvent = events.length > prevEventsLengthRef.current;
    prevEventsLengthRef.current = events.length;

    if (filteredEvents.length === 0) {
      if (selectedEventKey !== null) {
        setSelectedEventKey(null);
      }
      return;
    }

    if (followLatest && newEvent) {
      setSelectedEventKey(getEventKey(filteredEvents[0]));
      return;
    }

    if (
      !selectedEventKey ||
      !filteredEvents.some((event) => getEventKey(event) === selectedEventKey)
    ) {
      setSelectedEventKey(getEventKey(filteredEvents[0]));
    }
  }, [filteredEvents, selectedEventKey, followLatest, events.length]);

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton
            variant="plain"
            aria-label="Toggle sidebar"
            isSidebarOpen={isSidebarOpen}
            onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <BarsIcon />
          </PageToggleButton>
        </MastheadToggle>
        <MastheadBrand>
          <Title headingLevel="h1" size="lg">
            Analytics Dev Tool
          </Title>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar isFullHeight isStatic>
          <ToolbarContent>
            <ToolbarGroup align={{ default: 'alignEnd' }} alignItems="center">
              <ToolbarItem>
                <Flex
                  alignItems={{ default: 'alignItemsCenter' }}
                  spaceItems={{ default: 'spaceItemsSm' }}
                >
                  <FlexItem>
                    <Content component="small">Show</Content>
                  </FlexItem>
                  <FlexItem>
                    <ToggleGroup aria-label="Event filter">
                      <ToggleGroupItem
                        text="All"
                        buttonId="event-filter-all"
                        isSelected={filter === 'all'}
                        onChange={(_, selected) => {
                          if (selected) {
                            setFilter('all');
                          }
                        }}
                      />
                      <ToggleGroupItem
                        text="Captured"
                        buttonId="event-filter-captured"
                        isSelected={filter === 'captured'}
                        onChange={(_, selected) => {
                          if (selected) {
                            setFilter('captured');
                          }
                        }}
                      />
                    </ToggleGroup>
                  </FlexItem>
                </Flex>
              </ToolbarItem>
              <ToolbarItem>
                <Flex
                  alignItems={{ default: 'alignItemsCenter' }}
                  spaceItems={{ default: 'spaceItemsSm' }}
                >
                  <FlexItem>
                    <Content component="small">Type</Content>
                  </FlexItem>
                  <FlexItem>
                    <ToggleGroup aria-label="Event type filter">
                      <ToggleGroupItem
                        text="All"
                        buttonId="event-type-all"
                        isSelected={eventTypeFilter === 'all'}
                        onChange={(_, selected) => {
                          if (selected) {
                            setEventTypeFilter('all');
                          }
                        }}
                      />
                      <ToggleGroupItem
                        text="Interactions"
                        buttonId="event-type-interaction"
                        isSelected={eventTypeFilter === 'interaction'}
                        onChange={(_, selected) => {
                          if (selected) {
                            setEventTypeFilter('interaction');
                          }
                        }}
                      />
                      <ToggleGroupItem
                        text="Network"
                        buttonId="event-type-network"
                        isSelected={eventTypeFilter === 'network'}
                        onChange={(_, selected) => {
                          if (selected) {
                            setEventTypeFilter('network');
                          }
                        }}
                      />
                    </ToggleGroup>
                  </FlexItem>
                </Flex>
              </ToolbarItem>
              <ToolbarItem>
                <Flex alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <Badge isRead>
                      {filter === 'captured'
                        ? `${filteredEvents.length} shown`
                        : `${filteredEvents.length} events`}
                    </Badge>
                  </FlexItem>
                  {filter === 'captured' && (
                    <FlexItem>
                      <Content component="small">of {events.length}</Content>
                    </FlexItem>
                  )}
                </Flex>
              </ToolbarItem>
              <ToolbarItem>
                <Flex alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <Checkbox
                      id="follow-latest"
                      label="Select new event"
                      isChecked={followLatest}
                      onChange={(_event, checked) => setFollowLatest(checked)}
                    />
                  </FlexItem>
                </Flex>
              </ToolbarItem>
              <ToolbarItem>
                <Button variant="control" onClick={onClear}>
                  Clear
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <Button variant="plain" onClick={onClose} aria-label="Close analytics dev tool">
                  <TimesIcon />
                </Button>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );

  const sidebar = (
    <PageSidebar isSidebarOpen={isSidebarOpen}>
      <PageSidebarBody>
        <Nav aria-label="Event log navigation">
          <NavList>
            {filteredEvents.length === 0 ? (
              <NavItem isActive={false}>
                <Content component="small">
                  {filter === 'captured' ? 'No captured events in view' : 'No events captured yet'}
                </Content>
              </NavItem>
            ) : (
              filteredEvents.map((event) => (
                <NavItem
                  key={getEventKey(event)}
                  isActive={getEventKey(event) === selectedEventKey}
                  onClick={() => setSelectedEventKey(getEventKey(event))}
                >
                  <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsXs' }}>
                    <FlexItem>
                      <Content component="small">{getEventSummary(event)}</Content>
                    </FlexItem>
                    <FlexItem>
                      <Flex spaceItems={{ default: 'spaceItemsXs' }}>
                        <FlexItem>
                          <Badge isRead>{event.type}</Badge>
                        </FlexItem>
                        {event.type === 'interaction' && event.baselineMatch ? (
                          <FlexItem>
                            <Label isCompact color="green">
                              baseline
                            </Label>
                          </FlexItem>
                        ) : null}
                        <FlexItem>
                          <Content component="small">{getEventTime(event)}</Content>
                        </FlexItem>
                      </Flex>
                    </FlexItem>
                    {getCapturedSummary(event) && (
                      <FlexItem>
                        <Content component="small">Captured: {getCapturedSummary(event)}</Content>
                      </FlexItem>
                    )}
                  </Flex>
                </NavItem>
              ))
            )}
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page masthead={masthead} sidebar={sidebar} data-testid="analytics-devtool">
      <PageSection isFilled>
        <Tabs
          activeKey={activeTabKey}
          onSelect={(_, key) => setActiveTabKey(key)}
          aria-label="Event details tabs"
        >
          <Tab eventKey="details" title={<TabTitleText>Details</TabTitleText>}>
            <PageSection>
              <EventDetails event={selectedEvent} />
            </PageSection>
          </Tab>
          <Tab eventKey="payload" title={<TabTitleText>Segment Payload</TabTitleText>}>
            <PageSection>
              <SegmentPayload event={selectedEvent} />
            </PageSection>
          </Tab>
        </Tabs>
      </PageSection>
    </Page>
  );
};
