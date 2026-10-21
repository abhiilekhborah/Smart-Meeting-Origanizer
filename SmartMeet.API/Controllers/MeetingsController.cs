using Microsoft.AspNetCore.Mvc;
using SmartMeet.API.DTOs;
using SmartMeet.API.Services;
namespace SmartMeet.API.Controllers;

[ApiController, Route("api/meetings")]
public class MeetingsController(IMeetingService meetings) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List() => Ok(await meetings.List());
    [HttpGet("{id:int}")] public async Task<IActionResult> Get(int id) => Ok(await meetings.Get(id));
    [HttpPost] public async Task<IActionResult> Create(CreateMeetingDto dto)
    {
        var meeting = await meetings.Create(dto);
        return CreatedAtAction(nameof(Get), new { id = meeting.MeetingId }, meeting);
    }
    [HttpPut("{id:int}/end")] public async Task<IActionResult> End(int id) => Ok(await meetings.End(id));
    [HttpGet("{id:int}/summary"), ProducesResponseType(typeof(MeetingSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Summary(int id) => Ok(await meetings.Summary(id));
    [HttpGet("{id:int}/announcements"), ProducesResponseType(typeof(List<AnnouncementResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Announcements(int id) => Ok(await meetings.Announcements(id));
    [HttpPost("{id:int}/announcements"), ProducesResponseType(typeof(AnnouncementResponseDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Publish(int id, CreateAnnouncementDto dto)
    {
        var announcement = await meetings.Publish(id, dto);
        return Created($"/api/meetings/{id}/announcements", announcement);
    }
}
