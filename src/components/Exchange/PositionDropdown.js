import { Menu } from "@headlessui/react";
import { Trans } from "@lingui/macro";
import { HiDotsVertical } from "react-icons/hi";
import { AiOutlineEdit } from "react-icons/ai";
import { BiSelectMultiple } from "react-icons/bi";
import { RiShareBoxFill } from "react-icons/ri";

function PositionDropdown({ handleEditCollateral, handleShare, handleMarketSelect }) {
  return (
    <Menu>
      <Menu.Button as="div">
        <button className="mt-[3px] inline-flex items-center rounded-full p-[5px] text-[10px] text-slate-600 hover:bg-[#FFFFFF1a] hover:text-white">
          <HiDotsVertical fontSize={20} fontWeight={700} />
        </button>
      </Menu.Button>
      <div className="relative">
        <Menu.Items
          as="div"
          className="absolute top-[10px] right-0 z-[1000] w-full min-w-[155px] origin-top-right cursor-pointer list-none rounded-[4px] border border-slate-800 bg-slate-950 outline-none"
        >
          <Menu.Item>
            <div
              className="flex items-center rounded-[4px] py-[8.5px] px-2 text-[14px] text-slate-400 hover:bg-slate-700 hover:text-slate-100"
              onClick={handleEditCollateral}
            >
              <AiOutlineEdit fontSize={16} />
              <p className="m-0 pl-[10px]">
                <Trans>Edit Collateral</Trans>
              </p>
            </div>
          </Menu.Item>
          <Menu.Item>
            <div
              className="flex items-center rounded-[4px] py-[8.5px] px-2 text-[14px] text-slate-400 hover:bg-slate-700 hover:text-slate-100"
              onClick={handleMarketSelect}
            >
              <BiSelectMultiple fontSize={16} />
              <p className="m-0 pl-[10px]">
                <Trans>Select Market</Trans>
              </p>
            </div>
          </Menu.Item>
          {/* <Menu.Item>
            <div
              className="flex items-center rounded-[4px] py-[8.5px] px-2 text-[14px] text-slate-400 hover:bg-slate-700 hover:text-slate-100"
              onClick={handleShare}
            >
              <RiShareBoxFill fontSize={16} />
              <p className="m-0 pl-[10px]">
                <Trans>Share Position</Trans>
              </p>
            </div>
          </Menu.Item> */}
        </Menu.Items>
      </div>
    </Menu>
  );
}

export default PositionDropdown;
