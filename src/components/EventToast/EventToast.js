import Icon from "./AnnouncementIcon";
import { MdOutlineClose } from "react-icons/md";

export default function EventToast({ event, id, onClick, t }) {
  return (
    <div
      className={`relative w-[350px] rounded-[4px] border border-slate-800 bg-slate-950 text-white backdrop:blur-sm ${
        t.visible ? "zoomIn" : "zoomOut"
      }`}
      key={id}
    >
      <header className="flex items-center justify-between border-b border-slate-800 py-2 px-[15px]">
        <div className="flex items-center">
          <Icon className="h-5 w-5 text-white" />
          <p className="ml-[11.625px] py-[38.75px] text-[16px]">{event.title}</p>
        </div>
        <MdOutlineClose
          onClick={onClick}
          className="ml-[15px] h-[22px] w-[22px] cursor-pointer rounded-[4px] p-[2px] hover:bg-slate-800"
          color="white"
        />
      </header>
      <p className="my-2 px-[15px] text-[14px] leading-[1.5]">{event.bodyText}</p>
      <div className="mt-[15px] p-[15px] pt-0 text-[14px]">
        {event.buttons.map((button) => {
          if (button.newTab) {
            return (
              <a
                className="mr-[15px] text-slate-400 underline hover:text-white"
                key={event.id + button.text}
                target="_blank"
                rel="noreferrer noopener"
                href={button.link}
              >
                {button.text}
              </a>
            );
          } else {
            return (
              <a
                className="mr-[15px] text-slate-400 underline hover:text-white"
                key={event.id + button.text}
                href={button.link}
              >
                {button.text}
              </a>
            );
          }
        })}
      </div>
    </div>
  );
}
